/* eslint-disable react-hooks/exhaustive-deps */
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import tw from 'twrnc';
import {
  Camera,
  CameraPosition,
  DrawableFrame,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useSkiaFrameProcessor,
} from 'react-native-vision-camera';
import {
  useFaceDetector,
  FaceDetectionOptions,
  Contours,
} from 'react-native-vision-camera-face-detector';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Skia,
  PaintStyle,
  SkRect,
  SkPaint,
  ImageFormat,
  ColorType,
  AlphaType,
  ImageInfo,
} from '@shopify/react-native-skia';
import {useSharedValue} from 'react-native-worklets-core';

interface PermissionsPageProps {
  onRequestPermission: () => Promise<boolean>;
}

const PermissionsPage = ({onRequestPermission}: PermissionsPageProps) => (
  <View style={tw`flex-1 justify-center items-center p-4`}>
    <Text style={tw`text-lg mb-4 text-center`}>
      Camera permission is required.
    </Text>
    <Button title="Grant Permission" onPress={onRequestPermission} />
  </View>
);

const Loading = () => (
  <View style={tw`flex-1 justify-center items-center p-4`}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

const FaceDetector = () => {
  const cameraRef = useRef<Camera>(null);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const [rotationValue, setRotationValue] = useState(0); // Manually controlled rotation state
  const device = useCameraDevice(cameraPosition);
  const {hasPermission, requestPermission} = useCameraPermission();
  const sharedImage = useSharedValue<String | null>(null);
  const format = useCameraFormat(device, [
    {
      videoResolution: Dimensions.get('window'),
    },
    {
      fps: 30,
    },
  ]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Manual rotation using setInterval
  useEffect(() => {
    const interval = setInterval(() => {
      setRotationValue(prev => (prev + 3) % 360); // Increment rotation by 3° per frame
    }, 16); // Approximately 60 FPS (1000ms / 16 = ~60 FPS)

    return () => clearInterval(interval); // Cleanup interval when component unmounts
  }, []);

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    contourMode: 'all', // Using contours for face outline
    landmarkMode: 'none',
    classificationMode: 'none',
  }).current;

  const {detectFaces} = useFaceDetector(faceDetectionOptions);

  const clipFaceAndEncode = (
    frame: DrawableFrame,
    paint: SkPaint,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): string => {
    'worklet';

    // Step 1: Define the clipping rectangle dimensions
    const width = Math.max(1, Math.round(maxX - minX));
    const height = Math.max(1, Math.round(maxY - minY));

    if (width <= 0 || height <= 0) {
      throw new Error('Invalid clipping rectangle dimensions.');
    }

    // Step 2: Convert DrawableFrame to raw pixel data
    const buffer = frame.toArrayBuffer();

    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Frame buffer is empty or invalid.');
    }

    const byteArray = new Uint8Array(buffer);

    // Define the image format. Adjust based on your pixel data.
    // Common formats: RGBA_8888, BGRA_8888, etc.
    const colorType = ColorType.BGRA_8888; // Adjust if your data is different
    const alphaType = AlphaType.Premul; // Adjust based on your alpha handling

    const skData = Skia.Data.fromBytes(byteArray);

    const totalWidth = frame.width; // Replace with actual width
    const totalHeight = frame.height; // Replace with actual height

    const imageInfo: ImageInfo = {
      colorType,
      alphaType,
      width: totalWidth,
      height: totalHeight,
    };

    // Calculate bytes per row (stride)
    const bytesPerPixel = 4; // For RGBA_8888
    const bytesPerRow = totalWidth * bytesPerPixel;

    // Step 3: Create SkImage from raw pixels
    const skImage = Skia.Image.MakeImage(imageInfo, skData, bytesPerRow);

    if (!skImage) {
      throw new Error('Failed to create SkImage from raw pixel data.');
    }

    // Step 4: Create a new surface with the dimensions of the clipping rectangle
    const surface = Skia.Surface.Make(width, height);
    if (!surface) {
      throw new Error('Failed to create a new surface.');
    }

    const canvas = surface.getCanvas();

    if (!canvas) {
      throw new Error('Failed to get canvas from surface.');
    }

    // Step 6: Draw the image onto the new surface, mapping the clipping rectangle
    canvas.save();

    // Define the source rectangle from the original image
    const sourceRect: SkRect = {
      x: minX,
      y: minY,
      width: width,
      height: height,
    };

    // Define the destination rectangle on the new surface
    const destRect: SkRect = {
      x: 0,
      y: 0,
      width: width,
      height: height,
    };

    const degrees = 90; // 90 degrees clockwise
    canvas.rotate(degrees, width / 2, height / 2);

    // Draw the specified rectangle from the original image onto the new surface
    canvas.drawImageRect(
      skImage,
      sourceRect, // Source rectangle from the original image
      destRect, // Destination rectangle on the new surface
      paint,
    );

    canvas.restore();

    // Step 7: Retrieve the clipped image
    const clippedImage = surface.makeImageSnapshot();

    if (!clippedImage) {
      throw new Error('Failed to retrieve the clipped image.');
    }

    // Step 8: Encode the clipped image to Base64
    const base64ClippedImage = clippedImage.encodeToBase64(
      ImageFormat.PNG, // Change to ImageFormat.JPEG if desired
      100, // Adjust quality as needed (0-100)
    );

    if (!base64ClippedImage) {
      throw new Error('Failed to encode the clipped image to Base64.');
    }

    return base64ClippedImage;
  };

  // Helper function to draw a square based on the face contours
  const drawBoundingBox = (
    frame: DrawableFrame,
    faceContours: Contours,
    paint: any,
  ) => {
    'worklet';
    const facePoints = faceContours.FACE;

    // Ensure faceContours.FACE exists and has points
    if (!faceContours || !faceContours.FACE || faceContours.FACE.length === 0) {
      console.warn('No face contours detected.');
      return null;
    }

    // Get the minimum and maximum X and Y values
    const minX = Math.min(...facePoints.map(p => p.x));
    const maxX = Math.max(...facePoints.map(p => p.x));
    const minY = Math.min(...facePoints.map(p => p.y));
    const maxY = Math.max(...facePoints.map(p => p.y));

    // Validate coordinates
    if (minX >= maxX || minY >= maxY) {
      console.warn('Invalid bounding box coordinates.');
      return null;
    }

    const b64 = clipFaceAndEncode(frame, paint, minX, maxX, minY, maxY);
    sharedImage.value = b64;

    let rect: SkRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
    frame.drawRect(rect, paint);
    // Return the bounding box coordinates for drawing the arcs
    return {minX, maxX, minY, maxY};
  };

  // Helper function to draw three rotating arcs with gaps around the bounding box
  const drawRotatingArcs = (
    frame: DrawableFrame,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    paint: any,
    paintCounter: any,
    rotValue: number,
  ) => {
    'worklet';

    const radius = (maxX - minX) / 3;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const arcLength = 30; // Each arc covers 30°

    // Rotate the start points for each arc based on the animation
    const animatedRotation = rotValue % 360;
    const animatedRotationCounter = (-1 * rotValue) % 360;

    const arcProps = {
      x: centerX - radius - 40,
      y: centerY - radius - 40,
      width: radius * 2 + 80,
      height: radius * 2 + 80,
    };

    const arcPropsCounter = {
      x: centerX - radius - 50,
      y: centerY - radius - 50,
      width: radius * 2 + 100,
      height: radius * 2 + 100,
    };

    // Clockwise arcs
    for (let i = 0; i < 3; i++) {
      const startAngle = animatedRotation + i * 120;
      frame.drawArc(arcProps, startAngle, arcLength, false, paint);
    }

    // Counter clockwise arcs
    for (let i = 0; i < 3; i++) {
      const startAngle = animatedRotationCounter + i * 120;
      frame.drawArc(
        arcPropsCounter,
        startAngle,
        arcLength,
        false,
        paintCounter,
      );
    }
  };

  // Skia frame processor to handle the square and the three arcs
  const frameProcessor = useSkiaFrameProcessor(
    frame => {
      'worklet';

      frame.render();

      const faces = detectFaces(frame);

      for (const face of faces) {
        const faceContours = face.contours;

        const squarePaint = Skia.Paint();
        squarePaint.setColor(Skia.Color('white'));
        squarePaint.setStyle(PaintStyle.Stroke);
        squarePaint.setStrokeWidth(2);
        squarePaint.setAntiAlias(true);

        const arcPaint = Skia.Paint();
        arcPaint.setColor(Skia.Color('cyan'));
        arcPaint.setStyle(PaintStyle.Stroke);
        arcPaint.setStrokeWidth(2); // Thicker for emphasis
        arcPaint.setAntiAlias(true);

        const arcPaintCounter = Skia.Paint();
        arcPaintCounter.setColor(Skia.Color('green'));
        arcPaintCounter.setStyle(PaintStyle.Stroke);
        arcPaintCounter.setStrokeWidth(2); // Thicker for emphasis
        arcPaintCounter.setAntiAlias(true);

        // Draw the square and get its bounds
        const dimensions = drawBoundingBox(frame, faceContours, squarePaint);

        if (dimensions) {
          const {minX, maxX, minY, maxY} = dimensions;
          // Draw the rotating arcs around the square using the manual rotation state
          drawRotatingArcs(
            frame,
            minX,
            maxX,
            minY,
            maxY,
            arcPaint,
            arcPaintCounter,
            rotationValue,
          );
        }
      }
    },
    [rotationValue],
  ); // Re-run the frame processor whenever rotationValue changes

  const toggleCamera = () => {
    setCameraPosition(cameraPosition === 'back' ? 'front' : 'back');
  };

  if (device == null) {
    return <Loading />;
  }

  if (!hasPermission) {
    return <PermissionsPage onRequestPermission={requestPermission} />;
  }

  return (
    <View style={tw`flex-1 w-full h-full`}>
      <Camera
        ref={cameraRef}
        style={tw`absolute inset-0`}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        enableZoomGesture={true}
        enableFpsGraph={true}
        pixelFormat="rgb"
        format={format}
        fps={format?.maxFps}
        exposure={0}
      />

      {sharedImage.value && (
        <Image
          source={{
            uri: `data:image/png;base64,${sharedImage.value}`,
          }}
          style={tw`w-50 h-50 mt-4 absolute bottom-10 right-10`}
        />
      )}

      <View style={tw`absolute bottom-10 w-full flex-row justify-around`}>
        <TouchableOpacity onPress={toggleCamera}>
          <MaterialIcons name="cameraswitch" size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceDetector;
