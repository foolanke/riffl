# Model sources

Downloaded once and committed so nothing loads from the internet at runtime (SPEC 0.2).
All three are Google MediaPipe models, released under the Apache License 2.0.

| File | Used for | Source |
|---|---|---|
| hand_landmarker.task | Hand tracking (melody, hand-in-box) | MediaPipe Hand Landmarker |
| magic_touch.tflite | Object silhouettes, and click-to-add objects | MediaPipe Interactive Segmenter |
| efficientdet_lite2.tflite | Object suggestions (Settings > Objects) | MediaPipe Object Detector, EfficientDet-Lite2 float16 v1: https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite |
