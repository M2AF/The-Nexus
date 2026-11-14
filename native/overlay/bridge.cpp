#include "shared.h"
#include "vendor/minhook/include/MinHook.h"
#include <d3d11.h>
#include <d3d12.h>
#include <dxgi.h>
#include <wrl/client.h>
#include <sddl.h>
#include <vector>
#include <mutex>
#include <cstring>
using Microsoft::WRL::ComPtr;
Shared* gameShared=nullptr; HWND gameWindow=nullptr;
static Shared* hostShared=nullptr;static HANDLE hostMap=nullptr,gameMap=nullptr;
static WNDPROC originalWndProc=nullptr;static RECT savedClip{};static bool clipSaved=false;
static std::mutex inputMutex;
typedef HRESULT (STDMETHODCALLTYPE *PresentFn)(IDXGISwapChain*,UINT,UINT);
typedef HRESULT (STDMETHODCALLTYPE *ResizeFn)(IDXGISwapChain*,UINT,UINT,UINT,DXGI_FORMAT,UINT);
typedef void (STDMETHODCALLTYPE *ExecuteFn)(ID3D12CommandQueue*,UINT,ID3D12CommandList*const*);
static PresentFn realPresent=nullptr;static ResizeFn realResize=nullptr;static ExecuteFn realExecute=nullptr;
static decltype(&GetAsyncKeyState) realKey=&GetAsyncKeyState;
static decltype(&SetCursorPos) realCursor=&SetCursorPos;
static decltype(&ClipCursor) realClip=&ClipCursor;
extern void CaptureNexusQueue(ID3D12CommandQueue* queue);
static void Push(UINT message,WPARAM key,LPARAM pos){
 if(!gameShared)return;auto write=gameShared->inputWrite;auto next=(write+1)%InputCount;if(next==gameShared->inputRead)return;
 auto &i=gameShared->inputs[write];i={message,short(LOWORD(pos)),short(HIWORD(pos)),uint32_t(key),uint32_t((realKey(VK_SHIFT)<0?1:0)|(realKey(VK_CONTROL)<0?2:0)|(realKey(VK_MENU)<0?4:0))};MemoryBarrier();InterlockedExchange(&gameShared->inputWrite,next);
}
void ReleaseNexusInput(){if(clipSaved){realClip(&savedClip);clipSaved=false;}}
static LRESULT CALLBACK NexusWndProc(HWND hwnd,UINT msg,WPARAM w,LPARAM l){
 if(!Interactive()){ReleaseNexusInput();return CallWindowProcW(originalWndProc,hwnd,msg,w,l);}
 if(!clipSaved){GetClipCursor(&savedClip);clipSaved=true;realClip(nullptr);}
 switch(msg){
 case WM_MOUSEMOVE:case WM_LBUTTONDOWN:case WM_LBUTTONUP:case WM_RBUTTONDOWN:case WM_RBUTTONUP:case WM_MBUTTONDOWN:case WM_MBUTTONUP:Push(msg,w,l);return 0;
 case WM_MOUSEWHEEL:{POINT p{short(LOWORD(l)),short(HIWORD(l))};ScreenToClient(hwnd,&p);Push(msg,w,MAKELPARAM(p.x,p.y));return 0;}
 case WM_KEYDOWN:case WM_KEYUP:case WM_SYSKEYDOWN:case WM_SYSKEYUP:case WM_CHAR:Push(msg,w,l);return 0;
 case WM_INPUT:{return DefWindowProcW(hwnd,msg,w,l);}
 case WM_KILLFOCUS:InterlockedExchange(&gameShared->active,0);ReleaseNexusInput();break;
 }
 return CallWindowProcW(originalWndProc,hwnd,msg,w,l);
}
static SHORT WINAPI NexusKey(int key){return Interactive()?0:realKey(key);}
static BOOL WINAPI NexusCursor(int x,int y){return Interactive()?TRUE:realCursor(x,y);}
static BOOL WINAPI NexusClip(const RECT* rect){return Interactive()?realClip(nullptr):realClip(rect);}
static HRESULT STDMETHODCALLTYPE NexusPresent(IDXGISwapChain* swap,UINT sync,UINT flags){
 if(Live()){
  DXGI_SWAP_CHAIN_DESC desc{};if(SUCCEEDED(swap->GetDesc(&desc))&&desc.OutputWindow){
   if(!gameWindow){gameWindow=desc.OutputWindow;originalWndProc=(WNDPROC)SetWindowLongPtrW(gameWindow,GWLP_WNDPROC,(LONG_PTR)NexusWndProc);}
   if(gameWindow==desc.OutputWindow){
    static bool last=true;bool down=realKey(VK_MENU)<0&&realKey('C')<0;if(down&&!last&&GetForegroundWindow()==gameWindow)InterlockedExchange(&gameShared->active,!gameShared->active);last=down;
    if(!Interactive())ReleaseNexusInput();else if(!clipSaved){GetClipCursor(&savedClip);clipSaved=true;realClip(nullptr);}
    InterlockedIncrement64(&gameShared->presentCount);
    if(gameShared->active)RenderNexus(swap);
   }
  }
 }else ReleaseNexusInput();
 return realPresent(swap,sync,flags);
}
static HRESULT STDMETHODCALLTYPE NexusResize(IDXGISwapChain* swap,UINT n,UINT w,UINT h,DXGI_FORMAT f,UINT flags){ResetNexusRenderer();return realResize(swap,n,w,h,f,flags);}
static void STDMETHODCALLTYPE NexusExecute(ID3D12CommandQueue* queue,UINT n,ID3D12CommandList*const* lists){if(Live())CaptureNexusQueue(queue);realExecute(queue,n,lists);}
static DWORD WINAPI HookThread(void*){
 gameMap=OpenFileMappingW(FILE_MAP_ALL_ACCESS,FALSE,mappingName(GetCurrentProcessId()).c_str());if(!gameMap)return 0;
 gameShared=(Shared*)MapViewOfFile(gameMap,FILE_MAP_ALL_ACCESS,0,0,sizeof(Shared));if(!gameShared||gameShared->magic!=Magic||gameShared->version!=Version||gameShared->targetPid!=GetCurrentProcessId())return 0;
 if(MH_Initialize()!=MH_OK){InterlockedExchange(&gameShared->renderError,1);return 0;}
 const wchar_t* cls=L"NexusOverlayProbe";WNDCLASSW wc{};wc.lpfnWndProc=DefWindowProcW;wc.hInstance=GetModuleHandleW(nullptr);wc.lpszClassName=cls;RegisterClassW(&wc);
 HWND dummy=CreateWindowW(cls,L"",WS_OVERLAPPEDWINDOW,0,0,32,32,nullptr,nullptr,wc.hInstance,nullptr);
 DXGI_SWAP_CHAIN_DESC desc{};desc.BufferCount=1;desc.BufferDesc.Width=32;desc.BufferDesc.Height=32;desc.BufferDesc.Format=DXGI_FORMAT_R8G8B8A8_UNORM;desc.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;desc.OutputWindow=dummy;desc.SampleDesc.Count=1;desc.Windowed=TRUE;
 ComPtr<IDXGISwapChain> swap;ComPtr<ID3D11Device> dev;ComPtr<ID3D11DeviceContext> context;
 HRESULT hr=D3D11CreateDeviceAndSwapChain(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,0,nullptr,0,D3D11_SDK_VERSION,&desc,&swap,&dev,nullptr,&context);
 if(FAILED(hr)){InterlockedExchange(&gameShared->renderError,2);DestroyWindow(dummy);return 0;}
 void** vt=*(void***)swap.Get();
 bool ok=MH_CreateHook(vt[8],(void*)NexusPresent,(void**)&realPresent)==MH_OK&&MH_CreateHook(vt[13],(void*)NexusResize,(void**)&realResize)==MH_OK;
 ComPtr<ID3D12Device> dev12;ComPtr<ID3D12CommandQueue> queue;
 if(SUCCEEDED(D3D12CreateDevice(nullptr,D3D_FEATURE_LEVEL_11_0,IID_PPV_ARGS(&dev12)))){D3D12_COMMAND_QUEUE_DESC q{};q.Type=D3D12_COMMAND_LIST_TYPE_DIRECT;if(SUCCEEDED(dev12->CreateCommandQueue(&q,IID_PPV_ARGS(&queue)))){void** qv=*(void***)queue.Get();ok=ok&&MH_CreateHook(qv[10],(void*)NexusExecute,(void**)&realExecute)==MH_OK;}}
 ok=ok&&MH_CreateHookApi(L"user32.dll","GetAsyncKeyState",(void*)NexusKey,(void**)&realKey)==MH_OK;
 ok=ok&&MH_CreateHookApi(L"user32.dll","SetCursorPos",(void*)NexusCursor,(void**)&realCursor)==MH_OK;
 ok=ok&&MH_CreateHookApi(L"user32.dll","ClipCursor",(void*)NexusClip,(void**)&realClip)==MH_OK;
 if(ok)ok=MH_EnableHook(MH_ALL_HOOKS)==MH_OK;
 DestroyWindow(dummy);InterlockedExchange(&gameShared->ready,ok?1:0);if(!ok)InterlockedExchange(&gameShared->renderError,3);
 // No unload under a running graphics callback. Timeout releases input; hooks
 // become pass-through. The game owns this DLL until its normal process exit.
 for(;;){if(!Live()){InterlockedExchange(&gameShared->active,0);ReleaseNexusInput();if(gameShared->stop)break;}Sleep(100);}
 // Host issued NO_Stop: input is released and the watchdog ends cleanly. Hooks stay
 // installed as pass-through (Live() is false) until the game's own process exit.
 return 0;
}
BOOL WINAPI DllMain(HINSTANCE module,DWORD reason,LPVOID){if(reason==DLL_PROCESS_ATTACH){DisableThreadLibraryCalls(module);HANDLE t=CreateThread(nullptr,0,HookThread,nullptr,0,nullptr);if(t)CloseHandle(t);}return TRUE;}
extern "C" __declspec(dllexport) int NO_Create(uint32_t pid,uint32_t width,uint32_t height){
 if(hostShared||pid==0||pid==GetCurrentProcessId()||width<320||height<240||width>MaxWidth||height>MaxHeight)return 0;
 HANDLE token;DWORD size=0;if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return 0;GetTokenInformation(token,TokenUser,nullptr,0,&size);std::vector<uint8_t> user(size);if(!GetTokenInformation(token,TokenUser,user.data(),size,&size)){CloseHandle(token);return 0;}CloseHandle(token);
 LPWSTR sid=nullptr;ConvertSidToStringSidW(((TOKEN_USER*)user.data())->User.Sid,&sid);if(!sid)return 0;
 std::wstring sddl=L"D:P(A;;GA;;;"+std::wstring(sid)+L")";LocalFree(sid);PSECURITY_DESCRIPTOR sd=nullptr;if(!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(),SDDL_REVISION_1,&sd,nullptr))return 0;SECURITY_ATTRIBUTES sa{sizeof(sa),sd,FALSE};
 SetLastError(0);hostMap=CreateFileMappingW(INVALID_HANDLE_VALUE,&sa,PAGE_READWRITE,0,sizeof(Shared),mappingName(pid).c_str());DWORD error=GetLastError();LocalFree(sd);if(!hostMap)return 0;
 hostShared=(Shared*)MapViewOfFile(hostMap,FILE_MAP_ALL_ACCESS,0,0,sizeof(Shared));if(!hostShared){CloseHandle(hostMap);hostMap=nullptr;return 0;}
 if(error==ERROR_ALREADY_EXISTS){if(hostShared->magic!=Magic||hostShared->version!=Version||hostShared->targetPid!=pid||hostShared->width!=width||hostShared->height!=height||(!hostShared->stop&&GetTickCount64()-uint64_t(hostShared->heartbeat)<2000)){UnmapViewOfFile(hostShared);CloseHandle(hostMap);hostShared=nullptr;hostMap=nullptr;return 0;}hostShared->ownerPid=GetCurrentProcessId();hostShared->inputWrite=hostShared->inputRead=0;hostShared->active=0;InterlockedExchange64(&hostShared->heartbeat,GetTickCount64());InterlockedExchange(&hostShared->stop,0);return 1;}
 memset(hostShared,0,sizeof(Shared));hostShared->magic=Magic;hostShared->version=Version;hostShared->ownerPid=GetCurrentProcessId();hostShared->targetPid=pid;hostShared->width=width;hostShared->height=height;hostShared->heartbeat=GetTickCount64();hostShared->active=0;return 1;
}
extern "C" __declspec(dllexport) int NO_Attach(uint32_t pid,const wchar_t* file,const wchar_t* expected){
 if(!hostShared||hostShared->targetPid!=pid||!file||!expected||wcslen(file)>32760||GetFileAttributesW(file)==INVALID_FILE_ATTRIBUTES)return 0;
 HANDLE process=OpenProcess(PROCESS_CREATE_THREAD|PROCESS_QUERY_INFORMATION|PROCESS_VM_OPERATION|PROCESS_VM_WRITE|PROCESS_VM_READ,FALSE,pid);if(!process)return 0;
 wchar_t actual[32768];DWORD chars=32768;if(!QueryFullProcessImageNameW(process,0,actual,&chars)||CompareStringOrdinal(actual,chars,expected,-1,TRUE)!=CSTR_EQUAL){CloseHandle(process);return 0;}
 BOOL wow=FALSE;if(!IsWow64Process(process,&wow)||wow){CloseHandle(process);return 0;}
 if(hostShared->ready){CloseHandle(process);return 1;}
 SIZE_T bytes=(wcslen(file)+1)*sizeof(wchar_t);void* remote=VirtualAllocEx(process,nullptr,bytes,MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE);if(!remote){CloseHandle(process);return 0;}
 bool ok=WriteProcessMemory(process,remote,file,bytes,nullptr)!=FALSE;HANDLE thread=ok?CreateRemoteThread(process,nullptr,0,(LPTHREAD_START_ROUTINE)GetProcAddress(GetModuleHandleW(L"kernel32.dll"),"LoadLibraryW"),remote,0,nullptr):nullptr;
 if(thread){DWORD waited=WaitForSingleObject(thread,5000);DWORD result=0;if(waited==WAIT_OBJECT_0){GetExitCodeThread(thread,&result);ok=result!=0;VirtualFreeEx(process,remote,0,MEM_RELEASE);}else ok=false;CloseHandle(thread);}else{ok=false;VirtualFreeEx(process,remote,0,MEM_RELEASE);}CloseHandle(process);return ok?1:0;
}
extern "C" __declspec(dllexport) int NO_Frame(const uint8_t* pixels,uint32_t bytes){if(!hostShared||hostShared->magic!=Magic||hostShared->stop||!pixels||bytes>MaxPixels||bytes!=hostShared->width*hostShared->height*4)return 0;int next=1-hostShared->frameIndex;InterlockedIncrement(&hostShared->sequence);memcpy(hostShared->pixels[next],pixels,bytes);MemoryBarrier();InterlockedExchange(&hostShared->frameIndex,next);InterlockedIncrement(&hostShared->sequence);return 1;}
extern "C" __declspec(dllexport) void NO_Heartbeat(){if(hostShared)InterlockedExchange64(&hostShared->heartbeat,GetTickCount64());}
extern "C" __declspec(dllexport) int NO_Status(int key){if(!hostShared)return 0;switch(key){case 0:return hostShared->paintReady;case 6:return hostShared->ready;case 1:return hostShared->active;case 2:return hostShared->renderError;case 3:return hostShared->viewportWidth;case 4:return hostShared->viewportHeight;case 5:return int(hostShared->presentCount);case 7:{HANDLE p=OpenProcess(SYNCHRONIZE,FALSE,hostShared->targetPid);if(!p)return 0;bool alive=WaitForSingleObject(p,0)==WAIT_TIMEOUT;CloseHandle(p);return alive?1:0;}default:return 0;}}
extern "C" __declspec(dllexport) void NO_Active(int active){if(hostShared)InterlockedExchange(&hostShared->active,active?1:0);}
extern "C" __declspec(dllexport) int NO_Input(Input* out){if(!hostShared||!out)return 0;LONG read=hostShared->inputRead;if(read==hostShared->inputWrite)return 0;*out=hostShared->inputs[read];InterlockedExchange(&hostShared->inputRead,(read+1)%InputCount);return 1;}
extern "C" __declspec(dllexport) void NO_Stop(){if(!hostShared)return;InterlockedExchange(&hostShared->active,0);InterlockedExchange(&hostShared->stop,1);UnmapViewOfFile(hostShared);CloseHandle(hostMap);hostShared=nullptr;hostMap=nullptr;}
