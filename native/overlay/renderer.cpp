#include "shared.h"
#include <d3d11_1.h>
#include <d3d11on12.h>
#include <d3d12.h>
#include <dxgi1_4.h>
#include <d3dcompiler.h>
#include <wrl/client.h>
#include <mutex>
#include <vector>
#include <algorithm>
using Microsoft::WRL::ComPtr;
static std::recursive_mutex guard;
static ComPtr<ID3D12CommandQueue> queue;
struct Renderer{
 ComPtr<ID3D11Device> device;ComPtr<ID3D11DeviceContext> context;ComPtr<ID3D11On12Device> interop;
 ComPtr<ID3D11VertexShader> vs;ComPtr<ID3D11PixelShader> ps;ComPtr<ID3D11Buffer> constants;
 ComPtr<ID3D11Texture2D> texture;ComPtr<ID3D11ShaderResourceView> srv;ComPtr<ID3D11SamplerState> sampler;ComPtr<ID3D11BlendState> blend;
 ComPtr<ID3D11RasterizerState> raster;ComPtr<ID3D11DepthStencilState> depth;ComPtr<ID3DDeviceContextState> contextState;
 std::vector<ComPtr<ID3D11Resource>> wrapped;std::vector<ComPtr<ID3D11RenderTargetView>> targets;std::vector<uint8_t> pixels;
 IDXGISwapChain* swap=nullptr;LONG sequence=-1;
 void reset(){if(interop&&context){context->ClearState();context->Flush();}wrapped.clear();targets.clear();}
 ~Renderer(){reset();}
 HRESULT init(IDXGISwapChain* chain){
  swap=chain;HRESULT hr=chain->GetDevice(IID_PPV_ARGS(&device));
  if(FAILED(hr)){
   ComPtr<ID3D12Device> d12;if(FAILED(chain->GetDevice(IID_PPV_ARGS(&d12)))||!queue)return E_NOINTERFACE;
   ComPtr<ID3D12Device> qdev;queue->GetDevice(IID_PPV_ARGS(&qdev));if(qdev.Get()!=d12.Get())return E_NOINTERFACE;
   IUnknown* queues[]={queue.Get()};hr=D3D11On12CreateDevice(d12.Get(),D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,queues,1,0,&device,&context,nullptr);if(FAILED(hr))return hr;
   hr=device.As(&interop);if(FAILED(hr))return hr;
  }else{
   device->GetImmediateContext(&context);ComPtr<ID3D11Device1> d1;hr=device.As(&d1);if(FAILED(hr))return hr;D3D_FEATURE_LEVEL levels[]={D3D_FEATURE_LEVEL_11_1,D3D_FEATURE_LEVEL_11_0};D3D_FEATURE_LEVEL selected;
   hr=d1->CreateDeviceContextState(0,levels,2,D3D11_SDK_VERSION,__uuidof(ID3D11Device),&selected,&contextState);if(FAILED(hr))return hr;
  }
  const char* shader=R"(
cbuffer Placement:register(b0){float4 rect;};
struct Vertex{float4 position:SV_POSITION;float2 uv:TEXCOORD0;};
Vertex VS(uint id:SV_VertexID){float2 p[6]={float2(0,0),float2(1,0),float2(0,1),float2(0,1),float2(1,0),float2(1,1)};Vertex v;v.uv=p[id];v.position=float4(lerp(rect.xy,rect.zw,p[id]),0,1);return v;}
Texture2D image:register(t0);SamplerState smp:register(s0);
float4 PS(Vertex v):SV_TARGET{return image.Sample(smp,v.uv);}
)";
  ComPtr<ID3DBlob> vb,pb,error;hr=D3DCompile(shader,strlen(shader),nullptr,nullptr,nullptr,"VS","vs_5_0",0,0,&vb,&error);if(FAILED(hr))return hr;
  hr=D3DCompile(shader,strlen(shader),nullptr,nullptr,nullptr,"PS","ps_5_0",0,0,&pb,&error);if(FAILED(hr))return hr;
  if(FAILED(hr=device->CreateVertexShader(vb->GetBufferPointer(),vb->GetBufferSize(),nullptr,&vs)))return hr;
  if(FAILED(hr=device->CreatePixelShader(pb->GetBufferPointer(),pb->GetBufferSize(),nullptr,&ps)))return hr;
  D3D11_BUFFER_DESC cb{};cb.ByteWidth=16;cb.BindFlags=D3D11_BIND_CONSTANT_BUFFER;cb.Usage=D3D11_USAGE_DEFAULT;if(FAILED(hr=device->CreateBuffer(&cb,nullptr,&constants)))return hr;
  D3D11_TEXTURE2D_DESC td{};td.Width=gameShared->width;td.Height=gameShared->height;td.MipLevels=td.ArraySize=1;td.Format=DXGI_FORMAT_B8G8R8A8_UNORM;td.SampleDesc.Count=1;td.Usage=D3D11_USAGE_DEFAULT;td.BindFlags=D3D11_BIND_SHADER_RESOURCE;
  if(FAILED(hr=device->CreateTexture2D(&td,nullptr,&texture)))return hr;if(FAILED(hr=device->CreateShaderResourceView(texture.Get(),nullptr,&srv)))return hr;
  D3D11_SAMPLER_DESC sd{};sd.Filter=D3D11_FILTER_MIN_MAG_MIP_LINEAR;sd.AddressU=sd.AddressV=sd.AddressW=D3D11_TEXTURE_ADDRESS_CLAMP;sd.MaxLOD=D3D11_FLOAT32_MAX;if(FAILED(hr=device->CreateSamplerState(&sd,&sampler)))return hr;
  D3D11_BLEND_DESC bd{};auto &b=bd.RenderTarget[0];b.BlendEnable=TRUE;b.SrcBlend=D3D11_BLEND_ONE;b.DestBlend=D3D11_BLEND_INV_SRC_ALPHA;b.BlendOp=D3D11_BLEND_OP_ADD;b.SrcBlendAlpha=D3D11_BLEND_ONE;b.DestBlendAlpha=D3D11_BLEND_INV_SRC_ALPHA;b.BlendOpAlpha=D3D11_BLEND_OP_ADD;b.RenderTargetWriteMask=D3D11_COLOR_WRITE_ENABLE_ALL;if(FAILED(hr=device->CreateBlendState(&bd,&blend)))return hr;
  D3D11_RASTERIZER_DESC rd{};rd.FillMode=D3D11_FILL_SOLID;rd.CullMode=D3D11_CULL_NONE;rd.DepthClipEnable=TRUE;if(FAILED(hr=device->CreateRasterizerState(&rd,&raster)))return hr;
  D3D11_DEPTH_STENCIL_DESC dd{};dd.DepthEnable=FALSE;dd.StencilEnable=FALSE;if(FAILED(hr=device->CreateDepthStencilState(&dd,&depth)))return hr;
  DXGI_SWAP_CHAIN_DESC desc{};chain->GetDesc(&desc);UINT buffers=interop?desc.BufferCount:1;wrapped.resize(buffers);targets.resize(buffers);
  for(UINT i=0;i<buffers;i++){
   if(interop){ComPtr<ID3D12Resource> back;if(FAILED(hr=chain->GetBuffer(i,IID_PPV_ARGS(&back))))return hr;D3D11_RESOURCE_FLAGS flags{};flags.BindFlags=D3D11_BIND_RENDER_TARGET;hr=interop->CreateWrappedResource(back.Get(),&flags,D3D12_RESOURCE_STATE_RENDER_TARGET,D3D12_RESOURCE_STATE_PRESENT,IID_PPV_ARGS(&wrapped[i]));if(FAILED(hr))return hr;}
   else if(FAILED(hr=chain->GetBuffer(0,IID_PPV_ARGS(&wrapped[i]))))return hr;
   if(FAILED(hr=device->CreateRenderTargetView(wrapped[i].Get(),nullptr,&targets[i])))return hr;
  }
  pixels.resize(td.Width*td.Height*4);return S_OK;
 }
 void draw(IDXGISwapChain* chain){
  ComPtr<IDXGISwapChain3> s3;UINT index=interop&&SUCCEEDED(chain->QueryInterface(IID_PPV_ARGS(&s3)))?s3->GetCurrentBackBufferIndex():0;if(index>=targets.size())return;
  ComPtr<ID3D11DeviceContext1> c1;ComPtr<ID3DDeviceContextState> old;if(!interop){if(FAILED(context.As(&c1)))return;c1->SwapDeviceContextState(contextState.Get(),&old);}
  ID3D11Resource* resources[]={wrapped[index].Get()};if(interop)interop->AcquireWrappedResources(resources,1);
  LONG seq=gameShared->sequence;if(!(seq&1)&&seq!=sequence){int frame=gameShared->frameIndex;memcpy(pixels.data(),gameShared->pixels[frame],pixels.size());MemoryBarrier();if(seq==gameShared->sequence){context->UpdateSubresource(texture.Get(),0,nullptr,pixels.data(),gameShared->width*4,0);sequence=seq;}}
  ComPtr<ID3D11Texture2D> targetTexture;wrapped[index].As(&targetTexture);D3D11_TEXTURE2D_DESC desc{};targetTexture->GetDesc(&desc);InterlockedExchange(&gameShared->viewportWidth,desc.Width);InterlockedExchange(&gameShared->viewportHeight,desc.Height);
  float scale=std::min({1.f,float(desc.Width)/gameShared->width,float(desc.Height)/gameShared->height});float w=gameShared->width*scale,h=gameShared->height*scale;
  float placement[]={-w/desc.Width,h/desc.Height,w/desc.Width,-h/desc.Height};context->UpdateSubresource(constants.Get(),0,nullptr,placement,0,0);
  ID3D11RenderTargetView* rt=targets[index].Get();context->OMSetRenderTargets(1,&rt,nullptr);context->OMSetBlendState(blend.Get(),nullptr,0xffffffff);context->OMSetDepthStencilState(depth.Get(),0);
  D3D11_VIEWPORT vp{0,0,float(desc.Width),float(desc.Height),0,1};context->RSSetViewports(1,&vp);context->RSSetState(raster.Get());context->IASetInputLayout(nullptr);context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context->VSSetShader(vs.Get(),nullptr,0);ID3D11Buffer* cb=constants.Get();context->VSSetConstantBuffers(0,1,&cb);context->GSSetShader(nullptr,nullptr,0);context->HSSetShader(nullptr,nullptr,0);context->DSSetShader(nullptr,nullptr,0);context->PSSetShader(ps.Get(),nullptr,0);
  ID3D11ShaderResourceView* view=srv.Get();ID3D11SamplerState* sample=sampler.Get();context->PSSetShaderResources(0,1,&view);context->PSSetSamplers(0,1,&sample);context->Draw(6,0);
  if(interop){context->OMSetRenderTargets(0,nullptr,nullptr);interop->ReleaseWrappedResources(resources,1);context->Flush();}else c1->SwapDeviceContextState(old.Get(),nullptr);
 }
};
static std::unique_ptr<Renderer> renderer;
void CaptureNexusQueue(ID3D12CommandQueue* q){if(q->GetDesc().Type!=D3D12_COMMAND_LIST_TYPE_DIRECT)return;std::lock_guard lock(guard);if(!renderer)queue=q;}
void ResetNexusRenderer(){std::lock_guard lock(guard);renderer.reset();}
void RenderNexus(void* raw){if(!gameShared->sequence)return;std::lock_guard lock(guard);auto* swap=(IDXGISwapChain*)raw;try{if(!renderer){auto next=std::make_unique<Renderer>();HRESULT hr=next->init(swap);if(FAILED(hr)){InterlockedExchange(&gameShared->renderError,4);return;}renderer=std::move(next);InterlockedExchange(&gameShared->renderError,0);}if(renderer->swap==swap){renderer->draw(swap);InterlockedExchange(&gameShared->paintReady,1);}}catch(...){InterlockedExchange(&gameShared->renderError,5);}}
