from io import BytesIO
import tempfile
from pathlib import Path

import boto3
import nibabel as nib
import numpy as np
from botocore.client import Config
from botocore.exceptions import ClientError

from inference.runtime_settings import get_settings
from preprocessing.transforms import preprocess_image_array


def _load_runtime_config():
    from configs.experiment_config import load_experiment_config

    settings = get_settings()
    return load_experiment_config(settings.experiment_config_path)


_config = _load_runtime_config()


def load_nifti_bytes(data: bytes) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
        path = Path(tmp.name)
        path.write_bytes(data)
    try:
        image = nib.load(path)
        array = image.get_fdata(dtype=np.float32)
        if array.ndim == 4:
            array = array[..., 0]
        return {"image": array, "affine": image.affine, "header": image.header}
    finally:
        path.unlink(missing_ok=True)


def preprocess_volume(data: bytes) -> tuple[np.ndarray, np.ndarray]:
    sample = load_nifti_bytes(data)
    image = preprocess_image_array(sample["image"], _config)
    return image, sample["affine"]


def _nifti_to_bytes(image: nib.Nifti1Image) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
        path = Path(tmp.name)
    try:
        nib.save(image, path)
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)


def save_mask_nifti(mask: np.ndarray, affine: np.ndarray) -> bytes:
    output = nib.Nifti1Image(mask.astype(np.uint8), affine)
    return _nifti_to_bytes(output)


def get_runtime_config():
    return _config


class StorageClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
            region_name=settings.s3_region,
            use_ssl=settings.s3_use_ssl,
            config=Config(signature_version="s3v4"),
        )
        self._bucket = settings.s3_bucket_name

    def download(self, key: str) -> bytes:
        buffer = BytesIO()
        self._client.download_fileobj(self._bucket, key, buffer)
        return buffer.getvalue()

    def upload(self, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data, ContentType=content_type)
        return key

    def health_check(self) -> bool:
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return True
        except ClientError:
            return False

    def object_exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False


storage_client = StorageClient()
