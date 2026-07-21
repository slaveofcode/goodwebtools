// src/services/capture/types.test.ts
/**
 * Type-level tests to ensure TypeScript types match Rust types
 * and prevent parameter passing bugs
 */
import { describe, it, expectTypeOf } from 'vitest';
import type {
  CaptureService,
  CaptureOptions,
  DisplayInfo,
  Rectangle,
} from './types';

describe('CaptureService type safety', () => {
  it('showRegionSelector accepts optional number displayId', () => {
    type ShowRegionSelector = CaptureService['showRegionSelector'];

    // Should accept undefined
    expectTypeOf<ShowRegionSelector>().parameters.toMatchTypeOf<[undefined?]>();

    // Should accept number
    expectTypeOf<ShowRegionSelector>().parameters.toMatchTypeOf<[number?]>();

    // Should return Promise<Rectangle | null>
    expectTypeOf<ShowRegionSelector>().returns.toMatchTypeOf<Promise<Rectangle | null>>();
  });

  it('CaptureOptions displayId is optional number', () => {
    // displayId should be optional
    const withoutDisplayId: CaptureOptions = { format: 'png' };
    expectTypeOf(withoutDisplayId).toMatchTypeOf<CaptureOptions>();

    // displayId should accept number
    const withDisplayId: CaptureOptions = { format: 'png', displayId: 2 };
    expectTypeOf(withDisplayId).toMatchTypeOf<CaptureOptions>();

    // displayId should accept negative numbers (i32)
    const withNegativeId: CaptureOptions = { format: 'png', displayId: -2 };
    expectTypeOf(withNegativeId).toMatchTypeOf<CaptureOptions>();
  });

  it('DisplayInfo id is number (matches Rust i32)', () => {
    const display: DisplayInfo = {
      id: 1,
      name: 'Display 1',
      width: 1920,
      height: 1080,
      isMain: true,
    };

    // id should be number type (can be positive or negative)
    expectTypeOf(display.id).toBeNumber();

    // Should handle negative IDs
    const negativeDisplay: DisplayInfo = { ...display, id: -1 };
    expectTypeOf(negativeDisplay).toMatchTypeOf<DisplayInfo>();
  });

  it('all CaptureService methods are defined', () => {
    type RequiredMethods = {
      captureScreen: (options?: CaptureOptions) => Promise<Blob>;
      listDisplays: () => Promise<DisplayInfo[]>;
      captureWindow: (windowId?: string) => Promise<Blob>;
      captureRegion: (bounds: Rectangle) => Promise<Blob>;
      startRecording: (options?: any) => Promise<any>;
      stopRecording: (handle: any) => Promise<Blob>;
      showRegionSelector: (displayId?: number) => Promise<Rectangle | null>;
      getCapabilities: () => any;
    };

    // CaptureService should have all required methods
    expectTypeOf<CaptureService>().toMatchTypeOf<RequiredMethods>();
  });

  it('prevents common parameter bugs at compile time', () => {
    // This should compile - displayId is optional
    const validService: Pick<CaptureService, 'showRegionSelector'> = {
      showRegionSelector: async (displayId?: number) => null,
    };

    // TypeScript should catch if displayId parameter is missing
    expectTypeOf(validService.showRegionSelector).parameters.toMatchTypeOf<[number?]>();
  });
});
