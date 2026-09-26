# Endpoint Agent

Owns Request Help, ownership confirmation, remote-consent prompts and local runtime behavior.

Step 14 freezes the repository boundary but intentionally does not choose the Agent implementation language yet.
The Agent consumes the /api/v1/agent boundary and must not call MeshCentral as a substitute for INNO.One business APIs.
