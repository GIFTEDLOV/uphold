# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl


class StudioNextRunnerSmoke(gl.contract.Contract):
    def __init__(self):
        pass

    @gl.public.view
    def contract_info(self) -> str:
        return "UPHOLD_RUNNER_SMOKE"
