#include <windows.h>
#include <d3d12.h>
#include <dxgi1_4.h>
#include <wrl/client.h>
#include <cstdio>
#include <chrono>
#include <thread>
#include <string>
using Microsoft::WRL::ComPtr;
static bool running=true;static int keys=0;static int width=960,height=640;
static LRESULT CALLBACK Proc(HWND h,UINT m,WPARAM w,LPARAM l){if(m==WM_DESTROY){running=false;return 0;}if(m==WM_KEYDOWN)keys++;return DefWindowProcW(h,m,w,l);}
static void check(HRESULT hr){if(FAILED(hr)){printf("{\"error\":%ld}\n",long(hr));exit(2);}}
int main(int argc,char** argv){
 bool hidden=argc>1&&std::string(argv[1])=="--hidden";
 WNDCLASSW wc{};wc.lpfnWndProc=Proc;wc.hInstance=GetModuleHandleW(nullptr);wc.lpszClassName=L"NexusGraphicsFixture";RegisterClassW(&wc);
 HWND hwnd=CreateWindowW(wc.lpszClassName,L"Nexus DirectX 12 Test",WS_OVERLAPPEDWINDOW,40,40,width,height,nullptr,nullptr,wc.hInstance,nullptr);if(!hidden)ShowWindow(hwnd,SW_SHOWNOACTIVATE);
 ComPtr<IDXGIFactory4> factory;check(CreateDXGIFactory1(IID_PPV_ARGS(&factory)));ComPtr<ID3D12Device> device;check(D3D12CreateDevice(nullptr,D3D_FEATURE_LEVEL_11_0,IID_PPV_ARGS(&device)));
 D3D12_COMMAND_QUEUE_DESC q{};q.Type=D3D12_COMMAND_LIST_TYPE_DIRECT;ComPtr<ID3D12CommandQueue> queue;check(device->CreateCommandQueue(&q,IID_PPV_ARGS(&queue)));
 DXGI_SWAP_CHAIN_DESC1 sd{};sd.Width=width;sd.Height=height;sd.Format=DXGI_FORMAT_R8G8B8A8_UNORM;sd.SampleDesc.Count=1;sd.BufferCount=2;sd.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;sd.SwapEffect=DXGI_SWAP_EFFECT_FLIP_DISCARD;
 ComPtr<IDXGISwapChain1> sc;check(factory->CreateSwapChainForHwnd(queue.Get(),hwnd,&sd,nullptr,nullptr,&sc));ComPtr<IDXGISwapChain3> swap;sc.As(&swap);
 D3D12_DESCRIPTOR_HEAP_DESC hd{};hd.Type=D3D12_DESCRIPTOR_HEAP_TYPE_RTV;hd.NumDescriptors=2;ComPtr<ID3D12DescriptorHeap> heap;check(device->CreateDescriptorHeap(&hd,IID_PPV_ARGS(&heap)));auto start=heap->GetCPUDescriptorHandleForHeapStart();auto step=device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
 ComPtr<ID3D12Resource> buffers[2];for(int i=0;i<2;i++){check(swap->GetBuffer(i,IID_PPV_ARGS(&buffers[i])));D3D12_CPU_DESCRIPTOR_HANDLE target{start.ptr+SIZE_T(i)*step};device->CreateRenderTargetView(buffers[i].Get(),nullptr,target);}
 ComPtr<ID3D12CommandAllocator> allocator;check(device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT,IID_PPV_ARGS(&allocator)));ComPtr<ID3D12GraphicsCommandList> commands;check(device->CreateCommandList(0,D3D12_COMMAND_LIST_TYPE_DIRECT,allocator.Get(),nullptr,IID_PPV_ARGS(&commands)));commands->Close();
 ComPtr<ID3D12Fence> fence;check(device->CreateFence(0,D3D12_FENCE_FLAG_NONE,IID_PPV_ARGS(&fence)));HANDLE event=CreateEventW(nullptr,FALSE,FALSE,nullptr);UINT64 fenceValue=0;
 auto wait=[&](){check(queue->Signal(fence.Get(),++fenceValue));if(fence->GetCompletedValue()<fenceValue){fence->SetEventOnCompletion(fenceValue,event);WaitForSingleObject(event,5000);}};
 D3D12_HEAP_PROPERTIES hp{};hp.Type=D3D12_HEAP_TYPE_READBACK;D3D12_RESOURCE_DESC rd{};rd.Dimension=D3D12_RESOURCE_DIMENSION_BUFFER;rd.Width=UINT64(width)*height*4;rd.Height=1;rd.DepthOrArraySize=1;rd.MipLevels=1;rd.SampleDesc.Count=1;rd.Layout=D3D12_TEXTURE_LAYOUT_ROW_MAJOR;ComPtr<ID3D12Resource> readback;check(device->CreateCommittedResource(&hp,D3D12_HEAP_FLAG_NONE,&rd,D3D12_RESOURCE_STATE_COPY_DEST,nullptr,IID_PPV_ARGS(&readback)));
 printf("{\"pid\":%lu,\"ready\":true,\"api\":\"D3D12\"}\n",GetCurrentProcessId());fflush(stdout);int frames=0;bool overlaySeen=false;auto began=GetTickCount64();
 while(running&&GetTickCount64()-began<90000){if(frames%60==0){PostMessageW(hwnd,WM_KEYDOWN,'K',0);PostMessageW(hwnd,WM_CHAR,'k',0);}MSG msg;while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){TranslateMessage(&msg);DispatchMessageW(&msg);}UINT index=swap->GetCurrentBackBufferIndex();wait();allocator->Reset();commands->Reset(allocator.Get(),nullptr);
  D3D12_RESOURCE_BARRIER b{};b.Type=D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;b.Transition.pResource=buffers[index].Get();b.Transition.StateBefore=D3D12_RESOURCE_STATE_PRESENT;b.Transition.StateAfter=D3D12_RESOURCE_STATE_RENDER_TARGET;b.Transition.Subresource=D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;commands->ResourceBarrier(1,&b);float clear[]={0.02f,0.08f,0.2f,1.f};D3D12_CPU_DESCRIPTOR_HANDLE rt{start.ptr+index*step};commands->ClearRenderTargetView(rt,clear,0,nullptr);std::swap(b.Transition.StateBefore,b.Transition.StateAfter);commands->ResourceBarrier(1,&b);commands->Close();ID3D12CommandList* lists[]={commands.Get()};queue->ExecuteCommandLists(1,lists);check(swap->Present(0,0));wait();frames++;
  // Read the actual post-Present render target, rather than trusting hook status.
  allocator->Reset();commands->Reset(allocator.Get(),nullptr);b.Transition.StateBefore=D3D12_RESOURCE_STATE_PRESENT;b.Transition.StateAfter=D3D12_RESOURCE_STATE_COPY_SOURCE;commands->ResourceBarrier(1,&b);
  D3D12_TEXTURE_COPY_LOCATION from{};from.pResource=buffers[index].Get();from.Type=D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;D3D12_TEXTURE_COPY_LOCATION to{};to.pResource=readback.Get();to.Type=D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT;to.PlacedFootprint.Footprint={DXGI_FORMAT_R8G8B8A8_UNORM,UINT(width),UINT(height),1,UINT(width*4)};commands->CopyTextureRegion(&to,0,0,0,&from,nullptr);std::swap(b.Transition.StateBefore,b.Transition.StateAfter);commands->ResourceBarrier(1,&b);commands->Close();queue->ExecuteCommandLists(1,lists);wait();
  uint8_t* pixels=nullptr;D3D12_RANGE range{0,SIZE_T(width)*height*4};check(readback->Map(0,&range,(void**)&pixels));size_t p=(height/2*width+width/2)*4;unsigned red=pixels[p],green=pixels[p+1],blue=pixels[p+2];bool magenta=pixels[p]>180&&pixels[p+1]<90&&pixels[p+2]>130;readback->Unmap(0,nullptr);if(magenta&&!overlaySeen){overlaySeen=true;printf("{\"overlaySeen\":true,\"frame\":%d}\n",frames);fflush(stdout);}if(frames%60==0){printf("{\"frames\":%d,\"keys\":%d,\"overlaySeen\":%s,\"overlayVisible\":%s,\"pixel\":[%u,%u,%u]}\n",frames,keys,overlaySeen?"true":"false",magenta?"true":"false",red,green,blue);fflush(stdout);}std::this_thread::sleep_for(std::chrono::milliseconds(16));
 }
 wait();CloseHandle(event);DestroyWindow(hwnd);return 0;
}
