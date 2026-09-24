# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class RunnerProbe(gl.Contract):
    def __init__(self):
        pass

    @gl.public.view
    def ping(self) -> str:
        return "UPHOLD_RUNNER_PROBE_OK"
