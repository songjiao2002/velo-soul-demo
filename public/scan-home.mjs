// The same scanner surface serves the first screen and existing ?view=scan links.
export function scanHomeMarkup(){return `<section class="scan-home" aria-labelledby="scanHomeTitle">
 <div class="scan-home-intro"><span class="scan-edition">A LITTLE SOUL. A DIFFERENT RIDE.</span><h1 id="scanHomeTitle">작은 인사로,<br><em>시작되는 여정.</em></h1><p>자전거의 QR을 비추고, 오늘의 동반자를 만나세요.</p></div>
 <div class="scan-home-card">
  <div class="scan-card-caption"><span>01 / SCAN & MEET</span><span class="scan-camera-mark" aria-hidden="true">◎</span></div>
  <div class="camera-view scanning" id="cameraView">
   <video id="cameraVideo" autoplay playsinline muted aria-label="실시간 후면 카메라"></video>
   <div class="camera-placeholder"><svg class="scan-illustration" viewBox="0 0 400 320" aria-hidden="true" fill="none">
    <path class="scan-road" d="M-25 285C75 155 140 380 222 240S320 40 440 65"/><path class="scan-road-inner" d="M-25 285C75 155 140 380 222 240S320 40 440 65"/>
    <circle cx="200" cy="152" r="92" fill="#f8f4df"/><circle cx="200" cy="152" r="110" stroke="#c7d6b9" stroke-dasharray="2 8"/>
    <g class="scan-bike" stroke="#52705b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="145" cy="184" r="28"/><circle cx="254" cy="184" r="28"/><path d="m145 184 27-58 35 58h-62l40-40h53m-31 40 31-40 16 40m-16-40-8-23h18m-87 5h26"/></g>
    <path class="scan-spark" d="M202 79c0 15-8 23-23 23 15 0 23 8 23 23 0-15 8-23 23-23-15 0-23-8-23-23Z" fill="#e8b965"/>
    <path d="M109 95v12m-6-6h12m168 34v9m-5-5h10" stroke="#93ab78" stroke-width="2" stroke-linecap="round"/>
   </svg><span class="scan-preview-label">아직 만나지 않은 작은 친구</span></div>
   <span class="camera-label" id="cameraLabel">CAMERA OFF</span><div class="scan-target" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
   <span class="scan-live-hint">QR을 사각형 안에 맞춰주세요.</span>
  </div>
  <aside id="cameraRecovery" class="camera-recovery" data-no-translate hidden></aside>
  <div class="scan-home-action"><button class="primary" id="cameraStart" data-action="camera-start">자전거 QR 스캔하기</button><p class="camera-status" id="cameraStatus" role="status">버튼을 누르면 카메라가 켜져요.</p></div>
 </div>
 <div class="scan-home-bottom"><span>SCAN A BIKE. FIND A SOUL.</span><button class="scan-journal-link" data-nav="journal">나의 라이딩 일기 <span aria-hidden="true">↗</span></button></div>
</section>`;}
