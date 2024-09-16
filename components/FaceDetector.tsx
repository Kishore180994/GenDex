import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import tw from 'twrnc';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {
  Face,
  useFaceDetector,
  FaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import {Worklets} from 'react-native-worklets-core';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

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
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>(
    'back',
  );
  const [zoom, setZoom] = useState(1);
  const device = useCameraDevice(cameraPosition);
  const {hasPermission, requestPermission} = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    // detection options
  }).current;

  const {detectFaces} = useFaceDetector(faceDetectionOptions);

  const handleDetectedFaces = Worklets.createRunOnJS((faces: Face[]) => {
    console.log('faces detected', faces);
  });

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      const faces = detectFaces(frame);
      // ... chain frame processors
      // ... do something with frame
      handleDetectedFaces(faces);
    },
    [handleDetectedFaces],
  );

  const toggleCamera = () => {
    setCameraPosition(cameraPosition === 'back' ? 'front' : 'back');
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 1));
  };

  const handleFocus = async (event: GestureResponderEvent) => {
    if (cameraRef.current) {
      const {locationX, locationY} = event.nativeEvent;
      try {
        await cameraRef.current.focus({x: locationX, y: locationY});
      } catch (error) {
        console.error('Error focusing camera:', error);
      }
    }
  };

  if (device == null) {
    return <Loading />;
  }

  if (!hasPermission) {
    return <PermissionsPage onRequestPermission={requestPermission} />;
  }

  return (
    <View style={tw`flex-1 w-full h-full`} onTouchEnd={handleFocus}>
      <Camera
        ref={cameraRef}
        style={tw`absolute inset-0`}
        device={device}
        isActive={true}
        zoom={zoom}
        frameProcessor={frameProcessor}
      />
      <View style={tw`absolute bottom-10 w-full flex-row justify-around`}>
        <TouchableOpacity onPress={toggleCamera}>
          <MaterialIcons name="search" size={40} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={zoomIn}>
          <FontAwesome name="search-plus" size={40} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={zoomOut}>
          <FontAwesome name="search-minus" size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceDetector;
