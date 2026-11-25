import { describe, expect, it } from 'vitest';
import { describeDevice, deviceKind } from './deviceLabel';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
};

describe('describeDevice', () => {
  it('names browser and system the way a seller says them', () => {
    expect(describeDevice(UA.androidChrome)).toBe('Chrome · Android');
    expect(describeDevice(UA.androidTablet)).toBe('Chrome · Tablet Android');
    expect(describeDevice(UA.samsung)).toBe('Samsung Internet · Android');
    expect(describeDevice(UA.iphoneSafari)).toBe('Safari · iPhone');
    expect(describeDevice(UA.iphoneChrome)).toBe('Chrome · iPhone');
    expect(describeDevice(UA.windowsEdge)).toBe('Edge · Windows');
    expect(describeDevice(UA.macFirefox)).toBe('Firefox · Mac');
    expect(describeDevice(UA.headless)).toBe('Chrome · Linux');
  });
  it('tells an iPad asking for desktop sites from a Mac by its touch screen', () => {
    expect(describeDevice(UA.ipadDesktop, 5)).toBe('Safari · iPad');
    expect(describeDevice(UA.ipadDesktop, 0)).toBe('Safari · Mac');
  });
  it('returns what it knows, or nothing', () => {
    expect(describeDevice('curl/8.0')).toBe('');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
  });
  it('picks an icon kind', () => {
    expect(deviceKind('Chrome · Android')).toBe('phone');
    expect(deviceKind('Safari · iPad')).toBe('tablet');
    expect(deviceKind('Chrome · Tablet Android')).toBe('tablet');
    expect(deviceKind('Edge · Windows')).toBe('computer');
  });
});
