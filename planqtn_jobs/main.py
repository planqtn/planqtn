async def calculate_weight_enumerator(
    request: WeightEnumeratorRequest,
    user: Annotated[dict, Depends(get_supabase_user_from_token)],
):
    try:
        # Convert Pydantic model to dictionary
        request_dict = request.model_dump()
        request_dict["user_id"] = user["uid"]
        request_dict["token"] = user["token"]
        # Start the task
        print("kicking off task...")
        task = weight_enumerator_task.apply_async(
            args=[request_dict],
        )
        print("task", task.id)

        return TaskStatusResponse(task_id=task.id, status="started", result=None)
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return TaskStatusResponse(task_id="", status="error", error=str(e))


# @router.get(
#     "/list_tasks",
#     response_model=List[Dict[str, Any]],
# )
# async def list_tasks():
#     try:
#         task_store = RedisTaskStore(redis_url=get_settings().redis_url)
#         task_dict = task_store.get_all_tasks()
#         print("task_dict", task_dict)
#         all_tasks = []
#         for task_id, task_info in task_dict.items():
#             all_tasks.append(task_info)

#         return sorted(all_tasks, key=lambda x: x["received"], reverse=True)

#     except Exception as e:
#         print("error", e)
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# class CancelTaskRequest(BaseModel):
#     task_id: str


# @router.post("/cancel_task")
# async def cancel_task(request: CancelTaskRequest):
#     try:
#         # Revoke the task
#         celery_app.control.revoke(request.task_id, terminate=True)
#         return JSONResponse(
#             content={
#                 "status": "success",
#                 "message": f"Task {request.task_id} has been cancelled",
#             }
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @router.get("/userid")
# async def get_userid(user: Annotated[dict, Depends(get_supabase_user_from_token)]):
#     """gets the supabase connected user"""
#     return {"id": user["uid"], "email": user["email"]}


# class TaskRequest(BaseModel):
#     user_id: int
#     params: dict


# class TaskStatusResponse(BaseModel):
#     task_id: str
#     status: str
#     result: dict | None = None
#     error: str | None = None
