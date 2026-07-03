DEFAULT_TIMEOUT = 30


class TaskRunner:
    def run(self, task):
        return task

    def cancel(self, task_id):
        return task_id


def schedule(task, delay=0):
    return (task, delay)
