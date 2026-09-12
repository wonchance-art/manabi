import {describe, it, expect} from 'vitest';
import {boardCameraForBounds} from '../teachingBoardViewport';

describe('teaching board unobstructed paper', () => {
  const bounds=[100,100,420,308], viewport={width:558,height:278}, insets={top:68,bottom:74,right:37};
  it('keeps the complete expression above the mobile action bar, including at browser zoom', () => {
    const next=boardCameraForBounds(bounds,{zoom:{value:1},scrollX:0,scrollY:0},viewport,insets);
    const project=(v,scroll)=>(v+scroll)*next.zoom.value;
    expect(project(bounds[0],next.scrollX)).toBeGreaterThanOrEqual(16);
    expect(project(bounds[2],next.scrollX)).toBeLessThanOrEqual(505);
    expect(project(bounds[1],next.scrollY)).toBeGreaterThanOrEqual(84);
    expect(project(bounds[3],next.scrollY)).toBeLessThanOrEqual(188);
    expect(boardCameraForBounds(bounds,next,viewport,insets)).toBeNull();
  });
  it('does not move an already readable card or enlarge the teacher’s current zoom', () => {
    const camera={zoom:{value:.5},scrollX:0,scrollY:0};
    expect(boardCameraForBounds(bounds,camera,{width:900,height:700})).toBeNull();
    expect(boardCameraForBounds([4000,4000,4320,4208],camera,{width:900,height:700}).zoom.value).toBe(.5);
  });
  it('fits a whole explanation without changing its scene coordinates', () => {
    const next=boardCameraForBounds([-1000,-500,1000,500],{zoom:{value:1}}, {width:600,height:400},{top:60,bottom:60},true);
    expect(next.zoom.value).toBeLessThan(1);
    expect(next.scrollX).toBeCloseTo(300/next.zoom.value);
    expect(next.scrollY).toBeCloseTo(200/next.zoom.value);
  });
  it('ignores a hidden paper during the textbook-only layout', () => {
    expect(boardCameraForBounds(bounds,{}, {width:0,height:0},insets)).toBeNull();
  });
});
