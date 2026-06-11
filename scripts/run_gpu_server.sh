#!/usr/bin/env bash
set -euo pipefail

CONDA_ENV_NAME="${CONDA_ENV_NAME:-bys}"
CONDA_PREFIX="${PERSONAMASK_CONDA_PREFIX:-/home/bys0626/miniconda3/envs/${CONDA_ENV_NAME}}"
PYTHON_BIN="${PYTHON_BIN:-${CONDA_PREFIX}/bin/python}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8013}"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Python executable not found: ${PYTHON_BIN}" >&2
  exit 1
fi

export CONDA_PREFIX
export CONDA_DEFAULT_ENV="${CONDA_ENV_NAME}"
export PATH="${CONDA_PREFIX}/bin:${PATH}"

CUDA_LIB_DIRS=()
for nvidia_package_dir in "${CONDA_PREFIX}"/lib/python*/site-packages/nvidia; do
  [[ -d "${nvidia_package_dir}" ]] || continue
  while IFS= read -r lib_dir; do
    CUDA_LIB_DIRS+=("${lib_dir}")
  done < <(find "${nvidia_package_dir}" -mindepth 2 -maxdepth 2 -type d -name lib | sort)
done

if [[ ${#CUDA_LIB_DIRS[@]} -gt 0 ]]; then
  CUDA_LD_PATH="$(IFS=:; echo "${CUDA_LIB_DIRS[*]}")"
  export LD_LIBRARY_PATH="${CUDA_LD_PATH}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

export USE_GPU="${USE_GPU:-1}"
export EXECUTION_PROVIDERS="${EXECUTION_PROVIDERS:-CUDAExecutionProvider,CPUExecutionProvider}"
export PERSONAMASK_FACE_DETECTOR="${PERSONAMASK_FACE_DETECTOR:-auto}"
export PERSONAMASK_ONNXRUNTIME_PROVIDER="${PERSONAMASK_ONNXRUNTIME_PROVIDER:-CUDAExecutionProvider}"
export PERSONAMASK_INSIGHTFACE_CTX_ID="${PERSONAMASK_INSIGHTFACE_CTX_ID:-0}"
export PERSONAMASK_INSIGHTFACE_ROOT="${PERSONAMASK_INSIGHTFACE_ROOT:-/home/bys0626/.insightface}"
export PERSONAMASK_INSIGHTFACE_MODEL="${PERSONAMASK_INSIGHTFACE_MODEL:-buffalo_l}"
export NO_ALBUMENTATIONS_UPDATE="${NO_ALBUMENTATIONS_UPDATE:-1}"
export MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/matplotlib}"

exec "${PYTHON_BIN}" -m app.main --host "${HOST}" --port "${PORT}"
