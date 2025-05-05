pkill -e -9 -f "main.py|npm|vite|celery|serve.js|flower"
status=$?

if [ $status -eq 0 ]; then
    echo "There were processes to kill"
else
    echo "No processes to kill"
fi

