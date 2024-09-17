import React, {useEffect} from 'react';
import FaceDetector from './components/FaceDetector';
import {Skia} from '@shopify/react-native-skia';
import {View} from 'react-native-reanimated/lib/typescript/Animated';
import tw from 'twrnc';

const WarmUpSkia = () => {
  useEffect(() => {
    const warmUp = () => {
      const surface = Skia.Surface.Make(1, 1);
      const canvas = surface?.getCanvas();
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('white'));
      const rect = Skia.XYWHRect(0, 0, 1, 1); // Corrected line
      canvas?.drawRect(rect, paint);
      surface?.makeImageSnapshot();
    };

    warmUp();
  }, []);

  return null;
};
function App(): React.JSX.Element {
  return (
    <View style={tw`flex-1`}>
      <WarmUpSkia />
      <FaceDetector />
    </View>
  );
}

export default App;
