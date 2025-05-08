import logging
import traceback
from socketio import AsyncServer, ASGIApp
from celery.events import EventReceiver
from celery import Celery
import json
import asyncio
from typing import Dict, Set
from server.task_store import TaskStore


logger = logging.getLogger(__name__)


class SocketIOManager:
    def __init__(self):
        self.sio = AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            logger=logging.getLogger("socketio-server"),
            # engineio_logger=True,
        )
        self.app = ASGIApp(self.sio)
        self.active_rooms: Dict[str, Set[str]] = {}  # room_id -> set of socket_ids
        self.celery_app: Celery = None
        self.task_store = TaskStore()

        # Register event handlers for the tasks namespace

        self.setup_namespace("/")
        self.setup_namespace("/ws/tasks")
        self.setup_namespace("/ws/task")

    def setup_namespace(self, namespace: str):
        self.sio.on(
            "connect",
            lambda sid, environ: asyncio.create_task(
                self.connect(sid, environ, namespace)
            ),
            namespace=namespace,
        )
        self.sio.on(
            "connect",
            lambda sid, environ: asyncio.create_task(
                self.connect(sid, environ, namespace)
            ),
            namespace=namespace,
        )
        self.sio.on(
            "disconnect",
            lambda sid: asyncio.create_task(self.disconnect(sid, namespace)),
            namespace=namespace,
        )
        self.sio.on(
            "join_room",
            lambda sid, data: asyncio.create_task(self.join_room(sid, data, namespace)),
            namespace=namespace,
        )
        self.sio.on(
            "leave_room",
            lambda sid, data: asyncio.create_task(
                self.leave_room(sid, data, namespace)
            ),
            namespace=namespace,
        )

    def get_app(self):
        return self.app

    async def connect(self, sid, environ, namespace):
        logger.info(f"Client connected: {sid} on namespace {namespace}")
        # For /ws/tasks namespace, automatically join the tasks room
        if namespace == "/":
            try:
                await self.sio.enter_room(sid, "hello", namespace)
                if "hello" not in self.active_rooms:
                    self.active_rooms["hello"] = set()
                self.active_rooms["hello"].add(sid)
                logger.info(f"Client {sid} joined hello room in {namespace}")
            except Exception as e:
                logger.error(f"Error joining hello room: {e}", exc_info=True)

        elif namespace == "/ws/tasks":
            try:
                await self.sio.enter_room(sid, "tasks", namespace)
                if "tasks" not in self.active_rooms:
                    self.active_rooms["tasks"] = set()
                self.active_rooms["tasks"].add(sid)
                logger.info(f"Client {sid} joined tasks room in {namespace}")
            except Exception as e:
                logger.error(f"Error joining tasks room: {e}", exc_info=True)
        # For /ws/task namespace, extract task_id from path and join that room
        elif namespace == "/ws/task":
            path = environ.get("PATH_INFO", "")
            task_id = path.split("/")[-1]
            if task_id:
                try:
                    room_id = f"task_{task_id}"
                    await self.sio.enter_room(sid, room_id, namespace)
                    if room_id not in self.active_rooms:
                        self.active_rooms[room_id] = set()
                    self.active_rooms[room_id].add(sid)
                    logger.info(
                        f"Client {sid} joined task room {room_id} in {namespace}"
                    )
                except Exception as e:
                    logger.error(f"Error joining task room: {e}", exc_info=True)

    async def disconnect(self, sid, namespace):
        logger.info(f"Client disconnected: {sid} from namespace {namespace}")
        # Clean up any rooms the client was in
        for room in list(self.active_rooms.keys()):
            if sid in self.active_rooms[room]:
                self.active_rooms[room].remove(sid)
                if not self.active_rooms[room]:
                    del self.active_rooms[room]

    async def join_room(self, sid, data, namespace):
        room_id = data.get("room_id")
        if room_id:
            try:
                logger.info(
                    f"Client {sid} trying to join room {room_id} in {namespace}"
                )
                await self.sio.enter_room(sid, room_id, namespace)
                if room_id not in self.active_rooms:
                    self.active_rooms[room_id] = set()
                self.active_rooms[room_id].add(sid)

                if room_id == "hello":
                    logger.info(f"OK, we are now sending a hello message to {sid}")
                    await self.sio.emit(
                        "hello",
                        {"message": "Hello, world!"},
                        room=sid,
                        namespace=namespace,
                    )

                if room_id.startswith("task_"):
                    task_id = room_id[5:]
                    logger.info(f"SocketIO subscribing to task {task_id}")
                    # Create a new PubSub connection
                    pubsub = self.task_store.redis_async.pubsub()
                    await pubsub.subscribe(f"task_updates_{task_id}")
                    # Start the message reader task
                    asyncio.create_task(self._read_messages(pubsub, task_id, namespace))
            except Exception as e:
                logger.error(f"Error in join_room: {e}", exc_info=True)

    async def leave_room(self, sid, data, namespace):
        room_id = data.get("room_id")
        if room_id:
            await self.sio.leave_room(sid, room_id, namespace)
            if room_id in self.active_rooms and sid in self.active_rooms[room_id]:
                self.active_rooms[room_id].remove(sid)
                if not self.active_rooms[room_id]:
                    del self.active_rooms[room_id]

    async def _read_messages(self, pubsub, task_id: str, namespace: str):
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True)
                if message is not None:
                    # Decode the message data if it's bytes
                    message_data = message["data"]
                    if isinstance(message_data, bytes):
                        message_data = message_data.decode("utf-8")
                        try:
                            message_data = json.loads(message_data)
                        except json.JSONDecodeError:
                            logger.info(
                                f"Failed to decode message data as JSON: {message_data}"
                            )

                    await self.sio.emit(
                        "task_updated",
                        {
                            "id": task_id,
                            "type": "task_updated",
                            "message": message_data,
                        },
                        room=f"task_{task_id}",
                        namespace=namespace,
                    )
                await asyncio.sleep(0.1)  # Add a small delay to prevent busy waiting
        except Exception as e:
            logger.error(
                f"Error reading messages for task {task_id}: {e}", exc_info=True
            )
        finally:
            if pubsub.connection and not pubsub.connection._close:
                await pubsub.unsubscribe()
                await pubsub.close()

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

                        def sync_handler(event_type):
                            def wrapper(event):
                                logger.debug(f"Emitting event: {event}")

                                async def emit_event():
                                    try:
                                        task_details = self.task_store.get_task_details(
                                            event["uuid"]
                                        )
                                        if task_details:
                                            event["args"] = json.dumps(
                                                json.loads(task_details)["args"]
                                            )
                                        if event["type"] == "task-succeeded":
                                            event["result"] = json.dumps(
                                                json.loads(task_details)["result"]
                                            )
                                        # for security reasons, we don't want to expose the trace / the reals error message unless we know more
                                        if event["type"] == "task-failed":
                                            event["exception"] = "Server error"
                                            del event["traceback"]

                                        # Emit to the tasks room in the /ws/tasks namespace
                                        await self.sio.emit(
                                            "celery_event",
                                            event,
                                            room="tasks",
                                            namespace="/ws/tasks",
                                        )
                                        logger.debug(
                                            f"Emitted event to tasks room: {event['type']}"
                                        )
                                    except Exception as e:
                                        logger.info(f"Error emitting event: {e}")
                                        traceback.logger.info_exc()

                                # Run the async emit in the main event loop
                                main_loop.call_soon_threadsafe(
                                    lambda: asyncio.create_task(emit_event())
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
                        try:
                            await asyncio.get_event_loop().run_in_executor(
                                None,
                                lambda: recv.capture(
                                    limit=None, timeout=0.1, wakeup=True
                                ),
                            )
                        except TimeoutError:
                            pass
                        except Exception as e:
                            logger.error(
                                f"Error in Celery event capture: {e}", exc_info=True
                            )
                            await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error in Celery event monitor: {e}", exc_info=True)
                    await asyncio.sleep(5)

        # Start the monitor in a new task
        asyncio.create_task(monitor_events())


# Create a global instance
socketio_manager = SocketIOManager()
