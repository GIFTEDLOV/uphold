"""Run the v0.6 GLSim with the calldata compatibility shim required by RC2.

genlayer-py 0.19.0rc2 encodes the method name under the protocol's empty-key
field. The bundled GLSim decoder exposes the same wire format but only looks
for a human-readable ``method`` key. Normalize that boundary before importing
the server; contract behavior and consensus execution remain unchanged.
"""

from glsim import tx_decoder


_decode_calldata_bytes = tx_decoder.decode_calldata_bytes


def decode_calldata_bytes(raw: bytes) -> dict:
    decoded = _decode_calldata_bytes(raw)
    if isinstance(decoded, dict) and "method" not in decoded and "" in decoded:
        return {
            "method": decoded[""],
            "args": decoded.get("args", []),
            "kwargs": decoded.get("kwargs", {}),
        }
    return decoded


tx_decoder.decode_calldata_bytes = decode_calldata_bytes


def _install_transaction_value_compat(server) -> None:
    """Carry fee-aware user value into ``gl.message.value`` in RC2 GLSim."""

    original_send = server._rpc_eth_send_raw_transaction
    original_call = server._rpc_gen_call
    original_consensus = server.run_consensus

    def send_raw_transaction(state, engine, params):
        raw_hex = server._positional(params, 0)
        try:
            eth_tx = server.decode_raw_transaction(raw_hex)
            payload = server.decode_genlayer_payload(eth_tx["data"])
            value = payload.get("user_value")
            engine._uphold_user_value = int(value if value is not None else eth_tx["value"])
        except Exception:
            engine._uphold_user_value = 0
        return original_send(state, engine, params)

    def gen_call(state, engine, params):
        engine.vm.value = 0
        return original_call(state, engine, params)

    def run_consensus(engine, execute_fn, num_validators, max_rotations):
        user_value = int(getattr(engine, "_uphold_user_value", 0))

        # RC2's GLSim does not implement the strict_eq sandbox syscall. The
        # local consensus harness still needs to execute the validator's
        # deterministic capture function, so provide the equivalent in-process
        # result wrapper for this simulator boundary only.
        try:
            import genlayer.vm as gl_vm

            if not getattr(gl_vm, "_glsim_spawn_sandbox_patched", False):
                def spawn_sandbox_compat(fn, **_kwargs):
                    return gl_vm.Return(calldata=fn())

                gl_vm.spawn_sandbox = spawn_sandbox_compat
                gl_vm._glsim_spawn_sandbox_patched = True
        except ImportError:
            pass

        def execute_with_value():
            engine.vm.value = user_value
            return execute_fn()

        return original_consensus(engine, execute_with_value, num_validators, max_rotations)

    server.RPC_METHODS["eth_sendRawTransaction"] = send_raw_transaction
    server.RPC_METHODS["gen_call"] = gen_call
    server.run_consensus = run_consensus


if __name__ == "__main__":
    from glsim import server

    _install_transaction_value_compat(server)
    from glsim.__main__ import main

    main()
