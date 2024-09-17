/* eslint-disable react-hooks/exhaustive-deps */
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
import {Skia, PaintStyle} from '@shopify/react-native-skia';

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

    // Return the bounding box coordinates for drawing the arcs
    return {minX, maxX, minY, maxY};
  };

  // Helper function to draw three rotating arcs with gaps around the bounding box
  const drawRotatingArcs = (
    frame: any,
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
      const arcPath = Skia.Path.Make();
      arcPath.addArc(arcProps, animatedRotation + i * 120, arcLength);
      frame.drawPath(arcPath, paint);
    }

    // Counter clockwise arcs
    for (let i = 0; i < 3; i++) {
      const arcPath = Skia.Path.Make();
      arcPath.addArc(
        arcPropsCounter,
        animatedRotationCounter + i * 120,
        arcLength,
      );
      frame.drawPath(arcPath, paintCounter);
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
        const {minX, maxX, minY, maxY} = drawBoundingBox(
          frame,
          faceContours,
          squarePaint,
        );

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

      <View style={tw`absolute bottom-10 w-full flex-row justify-around`}>
        <TouchableOpacity onPress={toggleCamera}>
          <MaterialIcons name="cameraswitch" size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceDetector;
