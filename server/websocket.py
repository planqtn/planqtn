import traceback
from fastapi import WebSocket, WebSocketDisconnect
from celery.events import EventReceiver
from celery import Celery
import json
from typing import Any, Dict, Set
import asyncio
from contextlib import asynccontextmanager

import redis

from server.task_store import TaskStore


class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.task_update_subscriptions: Dict[str, redis.pubsub.PubSub] = {}
        self.celery_app: Celery = None
        self.task_store = TaskStore()

    def exception_handler(self, ex, pubsub, thread):
        print("Exception handler called")
        print(ex)
        thread.stop()
        # thread.join(timeout=1.0)
        pubsub.close()

    async def broadcast_task_update(self, message: Dict[str, Any]):
        assert message["type"] == "message"

        task_id = str(message["channel"])[len("b'task_updates_") : -1]

        # Decode the message data if it's bytes
        message_data = message["data"]
        if isinstance(message_data, bytes):
            message_data = message_data.decode("utf-8")
            try:
                message_data = json.loads(message_data)
            except json.JSONDecodeError:
                print(f"Failed to decode message data as JSON: {message_data}")

        await self.broadcast(
            {"id": task_id, "type": "task_updated", "message": message_data},
            "task_" + task_id,
        )

    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()

        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = set()
            if channel_id.startswith("task_"):
                task_id = channel_id[5:]
                print(f"WSManager subscribing to task {task_id}")

                # Create a new PubSub connection
                pubsub = self.task_store.redis_async.pubsub()
                await pubsub.subscribe(f"task_updates_{task_id}")

                # Store the PubSub connection
                self.task_update_subscriptions[channel_id] = pubsub

                # Start the message reader task
                asyncio.create_task(self._read_messages(pubsub, task_id))

        self.active_connections[channel_id].add(websocket)

    async def _read_messages(self, pubsub: redis.client.PubSub, task_id: str):
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True)
                if message is not None:
                    # print(f"Received message for task {task_id}: {message}")
                    await self.broadcast_task_update(message)
        except Exception as e:
            print(f"Error reading messages for task {task_id}: {e}")
        finally:
            if pubsub.connection and not pubsub.connection._close:
                await pubsub.unsubscribe()
                await pubsub.close()

    async def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_connections:
            self.active_connections[channel_id].remove(websocket)
            if not self.active_connections[channel_id]:
                del self.active_connections[channel_id]
                # Clean up the PubSub connection if it exists
                if channel_id in self.task_update_subscriptions:
                    pubsub = self.task_update_subscriptions[channel_id]
                    await pubsub.unsubscribe()
                    await pubsub.close()
                    del self.task_update_subscriptions[channel_id]

    async def broadcast(self, message: dict, channel_id: str):
        # print(f"Broadcasting to channel {channel_id}: {message}")
        if channel_id in self.active_connections:
            for connection in self.active_connections[channel_id]:
                try:
                    # print(f"Sending to connection: {message}")
                    await connection.send_json(message)
                except WebSocketDisconnect:
                    # print(f"Connection disconnected while broadcasting to {channel_id}")
                    self.disconnect(connection, channel_id)

    def set_celery_app(self, celery_app: Celery):
        self.celery_app = celery_app

    async def start_celery_event_monitor(self):
        if not self.celery_app:
            raise RuntimeError("Celery app not set")

        # Get the main event loop
        main_loop = asyncio.get_event_loop()

        async def monitor_events():
            while True:
                try:
                    with self.celery_app.connection() as connection:
                        # Create a synchronous wrapper for async handlers
                        def sync_handler(event_type):
                            def wrapper(event):
                                # Get the handler method
                                print(
                                    f"Handling task_{event_type} {type(event)} event: {event}"
                                )

                                task_args = self.task_store.get_task_details(
                                    event["uuid"]
                                )

                                if task_args:
                                    event["args"] = json.dumps(
                                        json.loads(task_args)["args"]
                                    )
                                main_loop.call_soon_threadsafe(
                                    lambda: asyncio.create_task(
                                        self.broadcast(event, "tasks")
                                    )
                                )

                            return wrapper

                        recv = EventReceiver(
                            connection,
                            handlers={
                                "task-sent": sync_handler("sent"),
                                "task-succeeded": sync_handler("succeeded"),
                                "task-failed": sync_handler("failed"),
                                "task-received": sync_handler("received"),
                                "task-revoked": sync_handler("revoked"),
                                "task-started": sync_handler("started"),
                            },
                        )
                        # Use a shorter timeout and handle it gracefully
                        try:
                            # Run the capture in a thread pool to avoid blocking
                            await asyncio.get_event_loop().run_in_executor(
                                None,
                                lambda: recv.capture(
                                    limit=None, timeout=0.1, wakeup=True
                                ),
                            )
                        except TimeoutError:
                            # This is expected - just continue the loop
                            pass
                        except Exception as e:
                            print(f"Error in Celery event capture: {e}")
                            traceback.print_exc()
                            await asyncio.sleep(1)
                except Exception as e:
                    print(f"Error in Celery event monitor: {e}")
                    traceback.print_exc()
                    await asyncio.sleep(5)  # Wait before retrying

        # Start the event monitor as a background task
        asyncio.create_task(monitor_events())


# Create a global instance
websocket_manager = WebSocketManager()
