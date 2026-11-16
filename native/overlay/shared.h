#pragma once
#include <windows.h>
#include <cstdint>
#include <string>
#include <atomic>
constexpr uint32_t Magic=0x4e584f31, Version=1, MaxWidth=1280, MaxHeight=900, MaxPixels=MaxWidth*MaxHeight*4, InputCount=256;
struct Input { uint32_t message; int32_t x,y; uint32_t key,flags; };
struct Shared {
 uint32_t magic,version,ownerPid,targetPid,width,height;
 volatile LONG active,stop,ready,paintReady,renderError,sequence,frameIndex,inputWrite,inputRead,viewportWidth,viewportHeight;
 volatile LONG64 heartbeat,presentCount;
 Input inputs[InputCount];
 uint8_t pixels[2][MaxPixels];
};
inline std::wstring mappingName(DWORD pid){return L"Local\\TheNexusOverlay.v1."+std::to_wstring(pid);}
extern Shared* gameShared;
extern HWND gameWindow;
void RenderNexus(void* swapchain);
void ResetNexusRenderer();
void ReleaseNexusInput();
inline bool Live(){return gameShared&&gameShared->magic==Magic&&!gameShared->stop&&GetTickCount64()-uint64_t(gameShared->heartbeat)<2000;}
inline bool Interactive(){return Live()&&gameShared->active&&gameShared->paintReady;}
