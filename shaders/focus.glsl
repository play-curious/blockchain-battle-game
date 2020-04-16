precision mediump float;


const float focusWidth = 0.1;
const float smoothWidth = 0.5;
const float totalWidth = focusWidth + smoothWidth;
const float blurSize = 1.0 / 512.0;
const float effectIntensity = 0.5;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform float progress;

void main(void)
{
  vec2 uv = vTextureCoord.xy;

  vec4 original = texture2D(uSampler, vTextureCoord);

  // Based on https://www.shadertoy.com/view/lsXGWn
  vec4 sum = vec4(0);

  // blur in y (vertical)
  // take nine samples, with the distance blurSize between them
  sum += texture2D(uSampler, vec2(uv.x - 4.0*blurSize, uv.y)) * 0.05;
  sum += texture2D(uSampler, vec2(uv.x - 3.0*blurSize, uv.y)) * 0.09;
  sum += texture2D(uSampler, vec2(uv.x - 2.0*blurSize, uv.y)) * 0.12;
  sum += texture2D(uSampler, vec2(uv.x - blurSize, uv.y)) * 0.15;
  sum += texture2D(uSampler, vec2(uv.x, uv.y)) * 0.16;
  sum += texture2D(uSampler, vec2(uv.x + blurSize, uv.y)) * 0.15;
  sum += texture2D(uSampler, vec2(uv.x + 2.0*blurSize, uv.y)) * 0.12;
  sum += texture2D(uSampler, vec2(uv.x + 3.0*blurSize, uv.y)) * 0.09;
  sum += texture2D(uSampler, vec2(uv.x + 4.0*blurSize, uv.y)) * 0.05;

  // blur in y (vertical)
  // take nine samples, with the distance blurSize between them
  sum += texture2D(uSampler, vec2(uv.x, uv.y - 4.0*blurSize)) * 0.05;
  sum += texture2D(uSampler, vec2(uv.x, uv.y - 3.0*blurSize)) * 0.09;
  sum += texture2D(uSampler, vec2(uv.x, uv.y - 2.0*blurSize)) * 0.12;
  sum += texture2D(uSampler, vec2(uv.x, uv.y - blurSize)) * 0.15;
  sum += texture2D(uSampler, vec2(uv.x, uv.y)) * 0.16;
  sum += texture2D(uSampler, vec2(uv.x, uv.y + blurSize)) * 0.15;
  sum += texture2D(uSampler, vec2(uv.x, uv.y + 2.0*blurSize)) * 0.12;
  sum += texture2D(uSampler, vec2(uv.x, uv.y + 3.0*blurSize)) * 0.09;
  sum += texture2D(uSampler, vec2(uv.x, uv.y + 4.0*blurSize)) * 0.05;

  // Create  
  float focusX = mix(-totalWidth, 1.0 + totalWidth, progress);
  float offsetX = uv.x + uv.y / 4.0;
  float intensity = 
      smoothstep(focusX - totalWidth, focusX - focusWidth, offsetX) 
      - smoothstep(focusX + focusWidth, focusX + totalWidth, offsetX);

  gl_FragColor = effectIntensity * intensity * sum + original;
}
