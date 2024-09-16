import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import tw from 'twrnc';
import {
  Camera,
  CameraPosition,
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
import {Skia, PaintStyle, BlurStyle} from '@shopify/react-native-skia';

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
  const device = useCameraDevice(cameraPosition);
  const {hasPermission, requestPermission} = useCameraPermission();
  const format = useCameraFormat(device, [
    {
      videoResolution: Dimensions.get('window'),
    },
    {
      fps: 60,
    },
  ]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    contourMode: 'all', // Using contours for face outline
    landmarkMode: 'none',
    classificationMode: 'none',
  }).current;

  const {detectFaces} = useFaceDetector(faceDetectionOptions);

  // Helper function to draw the face contour outline with shadow
  const drawFaceOutline = (
    frame: any,
    faceContours: Contours,
    paint: any,
    shadowPaint: any,
  ) => {
    'worklet';
    const path = Skia.Path.Make();

    const facePoints = faceContours.FACE;
    console.log({facePoints});
    facePoints.forEach((point, index) => {
      if (index === 0) {
        path.moveTo(point.x, point.y);
      } else {
        path.lineTo(point.x, point.y);
      }
    });
    path.close();

    // Draw shadowed outline (using mask filter)
    frame.drawPath(path, shadowPaint); // Draw shadow first
    frame.drawPath(path, paint); // Draw outline second
  };

  // Helper function to draw a square based on the face contours
  const drawBoundingBox = (frame: any, faceContours: Contours, paint: any) => {
    'worklet';
    const facePoints = faceContours['FACE'];

    // Get the minimum and maximum X and Y values
    const minX = Math.min(...facePoints.map(p => p.x));
    const maxX = Math.max(...facePoints.map(p => p.x));
    const minY = Math.min(...facePoints.map(p => p.y));
    const maxY = Math.max(...facePoints.map(p => p.y));

    // Adding padding for the square
    const padding = 10;

    // Draw a square using the min/max X and Y values
    const squarePath = Skia.Path.Make();
    squarePath.moveTo(minX - padding, minY - padding); // Top-left
    squarePath.lineTo(maxX + padding, minY - padding); // Top-right
    squarePath.lineTo(maxX + padding, maxY + padding); // Bottom-right
    squarePath.lineTo(minX - padding, maxY + padding); // Bottom-left
    squarePath.close();

    // Draw the square
    frame.drawPath(squarePath, paint);
  };

  // Helper function to draw partial lines at the corners of the square
  const drawPartialCorners = (
    frame: any,
    faceContours: Contours,
    paint: any,
  ) => {
    'worklet';
    const facePoints = faceContours['FACE'];

    // Get the minimum and maximum X and Y values
    const minX = Math.min(...facePoints.map(p => p.x));
    const maxX = Math.max(...facePoints.map(p => p.x));
    const minY = Math.min(...facePoints.map(p => p.y));
    const maxY = Math.max(...facePoints.map(p => p.y));

    const cornerLength = (maxX - minX) * 0.15; // Length of the partial square lines
    const padding = 10; // Adjust padding

    // Top-left corner
    frame.drawLine(
      minX - padding,
      minY - padding,
      minX - padding + cornerLength,
      minY - padding,
      paint,
    );
    frame.drawLine(
      minX - padding,
      minY - padding,
      minX - padding,
      minY - padding + cornerLength,
      paint,
    );

    // Top-right corner
    frame.drawLine(
      maxX + padding,
      minY - padding,
      maxX + padding - cornerLength,
      minY - padding,
      paint,
    );
    frame.drawLine(
      maxX + padding,
      minY - padding,
      maxX + padding,
      minY - padding + cornerLength,
      paint,
    );

    // Bottom-left corner
    frame.drawLine(
      minX - padding,
      maxY + padding,
      minX - padding + cornerLength,
      maxY + padding,
      paint,
    );
    frame.drawLine(
      minX - padding,
      maxY + padding,
      minX - padding,
      maxY + padding - cornerLength,
      paint,
    );

    // Bottom-right corner
    frame.drawLine(
      maxX + padding,
      maxY + padding,
      maxX + padding - cornerLength,
      maxY + padding,
      paint,
    );
    frame.drawLine(
      maxX + padding,
      maxY + padding,
      maxX + padding,
      maxY + padding - cornerLength,
      paint,
    );
  };

  // Skia frame processor to handle face outline, shadow, and square detection
  const frameProcessor = useSkiaFrameProcessor(frame => {
    'worklet';

    // First, render the frame context
    frame.render();

    const faces = detectFaces(frame);

    for (const face of faces) {
      // Get face contours
      const faceContours = face.contours;

      // Paint for the face outline
      const outlinePaint = Skia.Paint();
      outlinePaint.setColor(Skia.Color('cyan')); // Face outline color
      outlinePaint.setStyle(PaintStyle.Stroke);
      outlinePaint.setStrokeWidth(4);
      outlinePaint.setAntiAlias(true);

      // Shadow paint for the face outline shadow effect
      const shadowPaint = Skia.Paint();
      shadowPaint.setColor(Skia.Color('black'));
      shadowPaint.setStyle(PaintStyle.Stroke);
      shadowPaint.setStrokeWidth(8);
      shadowPaint.setMaskFilter(
        Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 15, true),
      );

      // Paint for the square and corner lines
      const squarePaint = Skia.Paint();
      squarePaint.setColor(Skia.Color('white')); // Square color
      squarePaint.setStyle(PaintStyle.Stroke);
      squarePaint.setStrokeWidth(2);
      squarePaint.setAntiAlias(true);

      // Draw face outline with shadow
      drawFaceOutline(frame, faceContours, outlinePaint, shadowPaint);

      // Draw the square inside the face contours
      drawBoundingBox(frame, faceContours, squarePaint);

      // Draw partial corner lines inside the square
      drawPartialCorners(frame, faceContours, squarePaint);
    }
  }, []);

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
      <View style={tw`absolute bottom-10 w-full flex-row justify-around`}>
        <TouchableOpacity onPress={toggleCamera}>
          <MaterialIcons name="search" size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceDetector;
