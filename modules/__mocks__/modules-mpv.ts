/* eslint-env jest */
import React from 'react';
import { View } from 'react-native';

const MpvView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
        seek: jest.fn(),
        setVolume: jest.fn(),
        setRate: jest.fn(),
        setPaused: jest.fn(),
        setSubtitleTrack: jest.fn(),
        setAudioTrack: jest.fn(),
    }));
    return React.createElement(View, props);
});

module.exports = {
    MpvView,
};
