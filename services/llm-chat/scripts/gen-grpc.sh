#!/usr/bin/env bash
# Regenerate the checked-in Python gRPC stubs in app/grpc_gen/ from api/proto/.
# Requires grpcio-tools (in requirements.txt). Run from anywhere.
#
#   services/llm-chat/scripts/gen-grpc.sh
#
# protoc emits flat `import <name>_pb2`; we rewrite it to a package-relative
# `from . import <name>_pb2` so app.grpc_gen imports cleanly.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"   # services/llm-chat
proto_dir="$here/../../api/proto"
out="$here/app/grpc_gen"

python -m grpc_tools.protoc -I "$proto_dir" \
  --python_out="$out" --grpc_python_out="$out" --pyi_out="$out" \
  "$proto_dir/embedding.proto" "$proto_dir/invoice.proto"

# Fixup relative imports in the *_grpc.py files (portable in-place sed).
for f in "$out"/*_pb2_grpc.py; do
  sed -i.bak -E 's/^import ([a-z_]+_pb2) as/from . import \1 as/' "$f"
  rm -f "$f.bak"
done

echo "Regenerated stubs in $out"
