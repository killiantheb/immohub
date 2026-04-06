'use client'
import { useEffect, useRef } from 'react'

interface Props {
  size?: number
  speaking?: boolean
  energy?: number
  className?: string
}

export function CathySphere({ size = 240, speaking = false, energy = 0, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ t: 0, speakS: 0, speakT: 0, energy: 0 })

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    cv.width = size
    cv.height = size
    const glRaw = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false })
    if (!glRaw) return
    const gl: WebGLRenderingContext = glRaw

    const VS = `attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`
    const FS = `
      precision highp float;
      uniform vec2 u_res; uniform float u_t; uniform float u_speak; uniform float u_energy;
      float h(float n){return fract(sin(n)*43758.5453);}
      float n3(vec3 x){
        vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        float n=i.x+i.y*157.+113.*i.z;
        return mix(mix(mix(h(n),h(n+1.),f.x),mix(h(n+157.),h(n+158.),f.x),f.y),
                   mix(mix(h(n+113.),h(n+114.),f.x),mix(h(n+270.),h(n+271.),f.x),f.y),f.z);
      }
      float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n3(p);p=p*2.02+vec3(1.5,.8,2.1);a*=.5;}return v;}
      float ff(vec3 p,float t){
        vec3 q=vec3(fbm(p+vec3(0,0,t*.08)),fbm(p+vec3(1.7,9.2,t*.07)),fbm(p+vec3(8.3,2.8,t*.09)));
        return fbm(p+2.8*q+vec3(t*.05,0,t*.04));
      }
      void main(){
        vec2 uv=(gl_FragCoord.xy/u_res)*2.-1.;uv.x*=u_res.x/u_res.y;
        float r=length(uv);if(r>1.06){gl_FragColor=vec4(0.);return;}
        float z=sqrt(max(0.,1.-r*r));vec3 sp=vec3(uv,z);
        float fl=ff(sp*1.6,u_t);float sfl=ff(sp*2.8,u_t*2.8);
        float eps=.003;
        float fx=ff((sp+vec3(eps,0,0))*1.6,u_t)+ff((sp+vec3(eps,0,0))*2.8,u_t*2.8)*u_speak*.5;
        float fy=ff((sp+vec3(0,eps,0))*1.6,u_t)+ff((sp+vec3(0,eps,0))*2.8,u_t*2.8)*u_speak*.5;
        vec3 N=normalize(sp-vec3(fx-fl,fy-fl,0.)*10.);
        float Reff=.80+(fl*.85+sfl*u_speak*.5)*.055-.018;
        bool ins=r<Reff;vec3 col=vec3(0.);
        vec3 L=normalize(vec3(-.6,.75,1.));vec3 V=vec3(0,0,1.);vec3 H=normalize(L+V);
        float d1=max(dot(N,L),0.);float sp1=pow(max(dot(N,H),0.),120.)*.95;float fr=pow(1.-max(dot(N,V),0.),4.);
        if(ins){
          float cau=n3(sp*4.+vec3(u_t*.12,0,0));
          col=vec3(.06,.018,.004)+vec3(.45,.15,.025)*d1*.7+vec3(.8,.38,.07)*pow(cau,1.9)*.45+vec3(1.,.85,.6)*sp1;
          col+=vec3(.7,.28,.04)*fr*.5+vec3(.04,.012,.002)*u_speak*n3(sp*6.+u_t)*.5;
        }
        float dE=abs(r-Reff);float rm=max(.1,.5+fl*.3+sfl*u_speak*.2);
        float rc=exp(-dE*180.)*rm*(1.+u_speak*.8+u_energy*.4);
        float rh=exp(-dE*55.)*rm*.5;float rb=exp(-dE*16.)*rm*.28;
        float co=exp(-max(0.,r-Reff)*18.)*rm*.3*(1.+max(0.,(uv.y+.3)/(Reff+.3))*.9);
        float rt=(rc+rh*.6+rb*.4+co)*(1.+u_speak*.8+u_energy*.5);
        vec3 cD=vec3(.5,.16,.02),cO=vec3(.831,.376,.102),cB=vec3(.96,.64,.26),cW=vec3(1.,.94,.88);
        vec3 rc2=mix(cD,cO,smoothstep(0.,.28,rt));
        rc2=mix(rc2,cB,smoothstep(.22,.7,rt));
        rc2=mix(rc2,cW,smoothstep(.55,1.,rc*(1.+u_speak)));
        col+=rc2*min(2.,rt);
        float al=ins?.96:0.;al+=min(.95,(rh+rb+co)*.85);al+=rc*.98;al=min(1.,al);
        if(r>Reff+.25)al=0.;
        gl_FragColor=vec4(col,al);
      }
    `
    function mkShader(type: number, src: string) {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog); gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
    const aLoc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(aLoc)
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uT = gl.getUniformLocation(prog, 'u_t')
    const uSpeak = gl.getUniformLocation(prog, 'u_speak')
    const uEnergy = gl.getUniformLocation(prog, 'u_energy')
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    let animId: number
    function render() {
      const s = stateRef.current
      s.speakS += (s.speakT - s.speakS) * 0.045
      s.energy = Math.max(0, s.energy - 0.012)
      s.t += s.speakS > 0.05 ? 0.018 : 0.005
      gl.viewport(0, 0, size, size)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uRes, size, size)
      gl.uniform1f(uT, s.t)
      gl.uniform1f(uSpeak, s.speakS)
      gl.uniform1f(uEnergy, s.energy)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animId = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(animId)
  }, [size])

  useEffect(() => { stateRef.current.speakT = speaking ? 1.0 : 0.0 }, [speaking])
  useEffect(() => { if (energy > 0) stateRef.current.energy = energy }, [energy])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', borderRadius: '50%' }} />
}
