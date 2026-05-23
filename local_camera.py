import asyncio
import os
import time
from typing import Optional, Tuple

import av
import cv2
import numpy as np
from aiortc import VideoStreamTrack
from aiortc.mediastreams import VIDEO_CLOCK_RATE, VIDEO_TIME_BASE, MediaStreamError


class OpenCVCameraTrack(VideoStreamTrack):
    def __init__(self, index: int, width: int = 640, height: int = 480, fps: int = 24):
        super().__init__()
        self.index = index
        self.width = width
        self.height = height
        self.fps = fps
        self._timestamp = None
        self._start_time = None
        self.cap = _open_capture(index, width, height, fps)
        if self.cap is None or not self.cap.isOpened():
            raise RuntimeError(f"无法打开 Camera {index}")

    async def next_timestamp(self):
        if self.readyState != "live":
            raise MediaStreamError

        frame_interval = 1 / max(self.fps, 1)
        if self._timestamp is None:
            self._start_time = time.time()
            self._timestamp = 0
        else:
            self._timestamp += int(frame_interval * VIDEO_CLOCK_RATE)
            wait = self._start_time + (self._timestamp / VIDEO_CLOCK_RATE) - time.time()
            if wait > 0:
                await asyncio.sleep(wait)
        return self._timestamp, VIDEO_TIME_BASE

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        try:
            ok, frame = self.cap.read()
        except cv2.error:
            ok, frame = False, None
        if not ok:
            frame = _blank_frame(self.width, self.height, f"Camera {self.index} disconnected")
        else:
            frame = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_AREA)

        video_frame = av.VideoFrame.from_ndarray(frame, format="bgr24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

    def stop(self):
        super().stop()
        _safe_release(self.cap)


def create_usb_first_camera_track(width: int = 640, height: int = 480, fps: int = 24, usb_wait_seconds: float = 3.0):
    index, source_label = select_usb_first_camera(width, height, fps, usb_wait_seconds)
    try:
        return OpenCVCameraTrack(index=index, width=width, height=height, fps=fps), source_label
    except Exception as exc:
        raise RuntimeError(f"找到 Camera {index}，但打开失败：{exc}") from exc


def select_usb_first_camera(width: int = 640, height: int = 480, fps: int = 24, usb_wait_seconds: float = 3.0) -> Tuple[int, str]:
    deadline = time.time() + usb_wait_seconds
    external_indexes = list(range(1, 4))

    while time.time() < deadline:
        for index in external_indexes:
            if _camera_works(index, width, height, fps):
                return index, f"已优先使用 USB/外接摄像头：Camera {index}"
        break

    if _camera_works(0, width, height, fps):
        return 0, "未快速发现外接摄像头，已回退到本机默认摄像头：Camera 0"

    raise RuntimeError("未找到可用摄像头。请检查 USB 摄像头连接或浏览器摄像头权限。")


def _open_capture(index: int, width: int, height: int, fps: int):
    backend = cv2.CAP_DSHOW if os.name == "nt" else cv2.CAP_ANY
    try:
        cap = cv2.VideoCapture(index, backend)
    except cv2.error:
        return None

    for prop, value in [
        (cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 500),
        (cv2.CAP_PROP_READ_TIMEOUT_MSEC, 500),
        (cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG")),
        (cv2.CAP_PROP_FRAME_WIDTH, width),
        (cv2.CAP_PROP_FRAME_HEIGHT, height),
        (cv2.CAP_PROP_FPS, fps),
        (cv2.CAP_PROP_BUFFERSIZE, 1),
    ]:
        try:
            cap.set(prop, value)
        except cv2.error:
            # Some DirectShow devices throw on property negotiation; keep probing.
            pass
    return cap


def _camera_works(index: int, width: int, height: int, fps: int) -> bool:
    cap = _open_capture(index, width, height, fps)
    try:
        if cap is None:
            return False
        try:
            opened = cap.isOpened()
        except cv2.error:
            return False
        if not opened:
            return False
        for _ in range(3):
            try:
                ok, _ = cap.read()
            except cv2.error:
                return False
            if ok:
                return True
        return False
    finally:
        _safe_release(cap)


def _safe_release(cap) -> None:
    if cap is None:
        return
    try:
        opened = cap.isOpened()
    except cv2.error:
        opened = True
    if not opened:
        return
    try:
        cap.release()
    except cv2.error:
        pass


def _blank_frame(width: int, height: int, text: Optional[str] = None):
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    if text:
        cv2.putText(frame, text, (24, height // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    return frame
