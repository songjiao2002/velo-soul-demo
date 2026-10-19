// Korean is the source language. Translation only touches presentation nodes,
// so changing language never remounts a camera, ride, or editable note.
const rows = `
우리의 길은 여기서 시작돼요.|Our path starts here.|我们的路，从这里开始。
GPS를 켜면 함께 간 길이 그려져요.|Turn on GPS to trace our journey.|开启 GPS，画下我们一起走过的路。
작은 여정이 남길 선을 기다려요.|A little journey, waiting to unfold.|等一段小小的旅程，留下线条。
실제 궤적 · 도로 지도 아님|GPS trace · not a street map|实际轨迹 · 非街道地图
위치 기록 대기|Waiting for GPS|等待定位记录
시작|Start|出发
지금|Now|现在

나는 이 자전거에 머물러.|This bicycle is where I stay.|我住在这辆自行车里。
오늘의 한 장면은 너와 함께하고 싶어.|I'd like to share a little of today with you.|想和你一起，遇见今天的一个瞬间。
함께 출발하기|Let's go together|和它一起出发
다른 만남 방식과 권한 안내|Other ways to meet & permissions|其他见面方式与权限说明
시작하면 카메라·마이크·위치를 요청해요. 음성과 AI 관찰 장면은 Qwen으로 보내요.|Starting requests camera, microphone and location. Voice and AI-observed frames go to Qwen.|开始后会请求相机、麦克风和定位权限；语音与 AI 观察画面将发送给千问。
잠깐 멈춘 뒤 시작해요. 달리는 동안에는 목소리로 함께해요.|Start while stopped. Once you're riding, let our voices keep you company.|停稳后再开始。骑行途中，让声音陪着你。
자전거에 머무는 작은 영혼들.|Little souls, each with a bicycle to call home.|每辆自行车里，住着一个小小的灵魂。
당신과 나눌 오늘의 한 장면을 기다려요.|Waiting to share a small moment of your day.|等你一起，遇见今天的某个瞬间。
저마다의 성격, 저마다의 이야기.|A different character. A different story.|不同的性格，各自的故事。
여정은 끝나도, 작은 이야기는 자전거에 남아요.|The ride ends. A little story can stay with the bicycle.|旅程会结束，一点故事可以留在车上。
원한다면 다음 만남을 위해 한마디를 맡겨 주세요.|If you like, leave a thought for the next meeting.|愿意的话，留一句话给下一次相遇。

기록 더 보기|Load more journeys|加载更多旅程
사진 더 보기|Show more photos|显示更多照片
기록을 불러오지 못했어요. 다시 시도해주세요.|Could not load journeys. Please try again.|未能加载旅程，请重试。
다시 시도|Try again|重试
사진 다시 저장|Download photo again|重新下载照片
저장 ↓|Save ↓|保存 ↓
사진을 누르면 다시 저장할 수 있어요.|Tap a photo to download it again.|点击照片可重新下载。
사진 다운로드를 요청했어요. 휴대폰의 다운로드 또는 파일 앱을 확인해주세요.|Photo download requested. Check Downloads or Files on your phone.|已请求下载照片，请查看手机的“下载”或“文件”。
사진 다운로드를 시작하지 못했어요. 사진을 다시 눌러주세요.|Could not start the download. Tap the photo to try again.|未能开始下载，请点击照片重试。
사진을 찍지 못했어요. 카메라가 준비되면 다시 눌러주세요.|Could not capture a photo. Try again when the camera is ready.|未能拍摄，请等相机就绪后重试。
촬영한 사진은 기기에 다운로드하고, 여정의 사진 미리보기와 GPS 경로는 이 브라우저에 보관해요. 다른 사람에게 자동으로 공유되지 않아요.|Captured photos download to your device. Journey photo previews and GPS trails stay in this browser and are not shared automatically.|抓拍照片下载到本机，旅程照片预览和 GPS 轨迹保存在本浏览器，不会自动分享。
위치·카메라·마이크 권한을 요청해요. 말하면 자동으로 Qwen에 보내고 음성으로 답해요. 화면·장소 정보도 함께 사용해요. GPS 허용 후 약 2km 격자 위치로 주변 날씨를 자동 조회해요.|Allow location, camera and microphone. Speak to send automatically to Qwen and hear a reply using scene and place context. GPS permission also enables automatic local weather using an approximate 2 km location grid.|允许定位、相机和麦克风，说完自动发送给千问并语音回答，同时结合画面和地点。允许 GPS 后使用约 2 公里网格位置自动查询当地天气。
등록한 서울 장소 3곳은 GPS로 감지해요. AI 관찰을 켜면 카메라 장면을 분석해요. GPS를 켜면 주변 날씨를 자동 조회해요. 그 외 주변 검색과 자전거의 초대는 시뮬레이션이에요. 소울은 화면 위의 2D AR이며 공간에 고정되지 않아요.|GPS detects 3 curated Seoul places and automatically checks local weather. AI observation analyzes camera scenes when enabled. Other nearby searches and bike invitations are simulated. Souls are 2D screen overlays without spatial tracking.|GPS 可检测已收录的首尔 3 处地点并自动查询当地天气。开启 AI 观察后分析相机画面，其他周边搜索和自行车邀约仍为模拟。灵魂是屏幕 2D 叠加，没有空间追踪。
카메라는 버튼을 누른 뒤에만 켜집니다. 촬영 버튼을 누르면 사진 다운로드를 요청해요. 사진 미리보기와 위치 기록은 이 브라우저에 보관하며 서버로 전송하지 않습니다. 대화 글·장소·날씨 요약은 Alibaba Cloud Qwen으로 전달됩니다. GPS를 켜면 날씨 조회를 위해 약 2km 격자 위치를 서버와 Open-Meteo에 보내며 정확한 좌표는 보내지 않습니다. AI 관찰을 켜면 분석용 카메라 이미지도 Qwen으로 보내며, 이 사이트에는 저장하지 않습니다. 카메라와 음성 대화를 켜면 마이크를 사용해요. 음성은 서버를 거쳐 Qwen에서 인식하며 녹음 파일은 저장하지 않아요. 답변 중에도 “잠깐” 명령을 듣습니다.|The camera starts after you tap a button. The shutter requests a photo download to your device. Photo previews and recorded trails stay in this browser. Chat text and place/weather summaries go to Alibaba Cloud Qwen. With GPS enabled, an approximate 2 km location grid goes to our server and Open-Meteo for weather; exact coordinates stay on your device. AI observation sends camera frames to Qwen without saving them on this site. Voice conversation uses the microphone and Qwen speech recognition via our server; recordings are not saved. You can say “stop” during a reply to interrupt.|点击按钮后才会开启相机，抓拍后会请求下载照片到本机，照片预览与轨迹保存在本浏览器。对话文字和地点、天气摘要发送给阿里云千问。开启 GPS 后会将约 2 公里网格位置发送到本站及 Open-Meteo 查询天气，不发送精确坐标。AI 观察将画面发送给千问，本站不保存分析图。语音对话通过本站调用千问识别，不保存录音；回答时可说“等一下”打断。
GPS 허용 후 약 2km 격자 위치로 주변 날씨를 자동 조회해요.|GPS permission also enables automatic weather using an approximate 2 km location grid.|允许 GPS 后，会使用约 2 公里网格位置自动查询当地天气。
등록한 서울 장소 3곳 · GPS 허용 후 자동 감지. 대화에는 장소와 날씨 요약을 보내요. 날씨 조회에는 약 2km 격자 위치를 사용해요.|3 curated Seoul places · Automatic after GPS permission. Chat receives place and weather summaries; weather uses an approximate 2 km location grid.|已收录首尔 3 处地点，GPS 授权后自动检测。对话使用地点与天气摘要，天气查询使用约 2 公里网格位置。
GPS를 켜면 주변 날씨를 자동으로 확인해요. 아래 버튼은 별도 시뮬레이션이에요.|GPS automatically checks local weather. The buttons below are separate simulations.|开启 GPS 后自动查询当地天气，下方按钮仍是独立的情景模拟。
GPS를 켜면 주변 날씨를 자동 확인해요. 전체 가게 검색과 근처 자전거 초대는 시뮬레이션이에요. 소울은 화면 위의 2D AR이며 공간에 고정되지 않아요.|GPS automatically checks local weather. Full shop search and nearby bike invitations are simulated. Souls are 2D screen overlays.|GPS 自动获取当地天气。全部店铺搜索与附近自行车邀约仍为模拟，灵魂为屏幕 2D 叠加。
위치·카메라·마이크 권한을 요청해요. 말하면 자동으로 Qwen에 보내고 음성으로 답해요. 화면·장소 정보도 함께 사용해요.|Allow location, camera and microphone. Speak to send automatically to Qwen and hear its reply, using current scene and place context.|允许定位、相机和麦克风。说完自动发送给千问并用语音回答，同时结合当前画面与地点信息。
음성 대화 켜기|Start voice conversation|开启连续语音

위치와 주변 날씨를 함께 확인하고 있어요.|Checking your location and local weather.|正在获取定位和当地天气。
마이크 음성은 Qwen으로 전송돼요. GPS를 허용하면 약 2km 격자 위치로 날씨를 확인해요.|Microphone audio goes to Qwen. With GPS permission, an approximate 2 km grid is used to check local weather.|麦克风语音会发送给千问。允许 GPS 后，使用约 2 公里网格位置查询当地天气。
GPS · 카메라 · 음성 함께 시작|Start live companionship|开启实时陪伴
위치·카메라 권한을 요청하고, 현재 화면과 장소 정보를 Qwen에 보내 목소리로 함께해요.|Allow location and camera. Current frames and place context go to Qwen for spoken companionship.|允许定位和相机，将当前画面与地点信息发送给千问，获得语音陪伴。
함께 시작|Start together|一起出发
카메라 권한을 기다리고 있어요.|Waiting for camera permission.|正在等待相机权限。
최근 촬영 사진|Latest captured photo|刚拍摄的照片
목소리 듣기|Hear my voice|试听声音
순간 담기|Take photo|拍摄

AI 관찰을 켜면 카메라 장면을 분석해요. GPS를 켜면 주변 날씨를 자동으로 확인해요. 주변 가게 검색과 자전거의 초대는 시뮬레이션이에요.|AI observation analyzes camera scenes. GPS automatically checks local weather. Nearby shop searches and bike invitations are simulated.|AI 观察可分析相机画面，GPS 自动获取当地天气。周边店铺搜索与自行车邀约仍为模拟。
대화 글과 장소 정보는 Alibaba Cloud Qwen으로 전달됩니다. AI 관찰을 켜면 분석용 카메라 이미지도 Qwen으로 보내며, 이 사이트에는 저장하지 않습니다.|Chat text and place information go to Alibaba Cloud Qwen. Enabling AI observation also sends camera images to Qwen; this site does not save those analysis images.|对话文字与地点信息会发送给阿里云千问。开启 AI 观察后也会向千问发送相机图片；本站不保存分析用图。
카메라와 음성 대화를 켜면 마이크를 사용해요. 음성은 서버를 거쳐 Qwen에서 인식하며 녹음 파일은 저장하지 않아요. 답변 중에도 “잠깐” 명령을 듣습니다.|Camera with voice uses your microphone. Audio goes through our server to Qwen for recognition; recordings are not saved. “Stop” detection continues during replies.|开启相机语音陪伴后使用麦克风。音频经本站发送给千问识别，不保存录音文件。回答时保留“等一下”的打断监听。
AI 관찰을 켜기 전에는 화면을 서버로 보내지 않아요.|Camera frames stay on your device until you enable AI observation.|开启 AI 观察前，相机画面不会发送到服务器。
카메라의 AI 관찰을 켜면 실제 장면에 반응해요. 아래 버튼은 별도 시뮬레이션이에요.|Enable AI observation in the camera to respond to real scenes. The buttons below are separate simulations.|在相机中开启 AI 观察即可根据真实画面回应；下方按钮是独立的情景模拟。
등장 애니메이션 다시 보기|Replay entrance|重播出场动画
기본 안내 / AI 사용 불가|Preset / AI unavailable|预设台词／AI 暂不可用
Reading with your device voice|Reading with your device voice|正在使用设备声音朗读
등록한 서울 장소 3곳은 GPS로 감지해요. 그 외 주변 검색, 사물 인식, 날씨, 자전거의 초대는 시뮬레이션이에요. 소울은 화면 위의 2D AR이며 공간에 고정되지 않아요.|GPS detects 3 curated Seoul places. Other nearby searches, object recognition, weather and bicycle invitations are simulations. Souls are 2D screen overlays without spatial tracking.|GPS 可检测已收录的首尔 3 处地点；其他周边搜索、相机识物、天气与自行车邀约为模拟。灵魂是 2D 画面叠加，没有空间追踪。
소울과 대화하기 ↗|Chat with your Soul ↗|和灵魂对话 ↗
근처 장소에서 소울이 말해요|Your Soul notices nearby places|靠近地点时灵魂会主动说话
등록한 서울 장소 3곳 · GPS 허용 후 자동 감지. 대화에는 장소·날씨 요약을 보내고, 날씨 조회에는 약 2km 격자 위치를 사용해요.|3 curated Seoul places · Automatic after GPS permission. Chat receives place and weather summaries; weather lookup uses an approximate 2 km location grid.|已收录首尔 3 处地点，GPS 授权后自动检测。对话使用地点与天气摘要，天气查询使用约 2 公里网格位置。
GPS를 켜면 근처 장소를 기다려요.|Enable GPS to notice nearby places.|开启 GPS 后会等待进入地点范围。
위치 없이 상황 테스트|Try without changing your location|不改变真实定位的情景测试
선택한 장소 도착 시뮬레이션|Simulate arrival at this place|模拟到达所选地点
기본 안내 / AI 연결 전|Preset / AI not connected|预设台词／AI 尚未连接

EN · 미국식 영어 · 가볍고 호기심 있게|EN · American · Light & curious|EN · 美式 · 轻快好奇
EN · 영국식 영어 · 느긋하고 부드럽게|EN · British · Calm & gentle|EN · 英式 · 舒缓温柔
EN · 미국식 영어 · 따뜻하고 신나게|EN · American · Warm & animated|EN · 美式 · 热情活泼
듣기|Listen|试听
인사 듣기|Hear my hello|听我打招呼
버튼을 눌러 목소리를 들어보세요.|Tap to hear my voice.|点一下，听听我的声音。
소리를 켜려면 듣기 버튼을 눌러주세요.|Tap a Listen button to enable audio.|请点击试听按钮开启声音。

EN · 미국식 영어 우선 · 가볍고 호기심 있게|EN · American preferred · Light & curious|EN · 优先美式 · 轻快好奇
EN · 영국식 영어 우선 · 느긋하고 부드럽게|EN · British preferred · Calm & gentle|EN · 优先英式 · 舒缓温柔
EN · 미국식 영어 우선 · 따뜻하고 신나게|EN · American preferred · Warm & animated|EN · 优先美式 · 热情活泼
원하는 지역 음성이 없어 다른 영어 음성을 사용해요.|Preferred accent unavailable; using another English voice.|设备缺少目标口音，正在使用其他英语音源。
영어 음원을 사용할 수 없어요. 한국어 음성을 선택하거나 자막으로 체험해주세요.|English audio is unavailable here. Choose Korean audio or use subtitles.|此设备无法使用英语音源。请选择韩语语音或通过字幕体验。
영어 음성을 시작하지 못했어요. 다시 듣거나 한국어 음성을 선택해주세요.|English audio couldn't start. Try again or choose Korean audio.|英语语音未能启动。请重试或选择韩语语音。

화면|UI|界面
음성 언어|Voice language|语音语言
음성|Voice|语音
영어 목소리 재생 중|Playing English audio|正在播放英语语音
이 기기에 영어 읽기 음성이 없어요. 이 상황은 자막으로 체험해요.|This device has no English speech voice. Enjoy this scene with subtitles.|此设备没有英语朗读语音，请通过字幕体验此情景。
기기의 영어 음성으로 읽는 중|Reading with the device's English voice|正在使用设备的英语语音朗读
영어 음성이 선택됐어요.|English voice selected.|已选择英语语音。
한국어 음성이 선택됐어요.|Korean voice selected.|已选择韩语语音。
주 메뉴|Main navigation|主导航
인터페이스 언어|Interface language|界面语言
소울 만나기|Meet the Souls|遇见灵魂
우리의 기록|Our journal|我们的记录
프로젝트 소개|About the project|项目介绍
함께 달리고, 함께 기억해요.|Ride together. Remember together.|一起骑行，一起珍藏。
이동수단에서,|From a bicycle,|从一辆自行车，
곁에 있는 존재로.|to a companion.|到陪在身边的伙伴。
자전거마다 다른 성격의 소울이 살고 있다면, 평범한 라이딩은 어떤 시간이 될까요?|What if every bicycle had a Soul with its own personality? How would an everyday ride feel?|如果每辆自行车都住着一个性格不同的灵魂，平凡的骑行会变成怎样的时光？
우리는 자전거가 자연스러운 동반자로 느껴지는지, 여정이 더 풍부해지는지, 이 경험을 다시 만나고 싶은지 탐색합니다.|We explore whether a bicycle can feel like a natural companion, enrich a journey, and become someone you want to meet again.|我们探索自行车能否成为自然的同行伙伴，让旅程更加丰富，让人期待再次相遇。
이 프로토타입에서 가능한 것|What works in this prototype|原型已实现的功能
실제 카메라 · QR 인식 · 선택적 GPS 기록 · 영어/한국어 음성 · 이 기기에 저장하는 여정 카드|Live camera · QR scanning · Optional GPS tracking · English/Korean audio · Journey cards stored on this device|真实相机 · 二维码识别 · 可选 GPS 记录 · 英语／韩语语音 · 本机旅程卡片
상황을 골라 체험하는 것|Scenarios to try|可选择体验的演示情景
사물 인식, 날씨, 주변 가게, 자전거의 근처 초대는 시뮬레이션입니다. 캐릭터는 화면 위에 나타나는 2D AR 연출이며 공간에 고정되지 않습니다.|Object recognition, weather, nearby shops, and nearby bike invitations are simulated. The character is a 2D overlay, not anchored to the real world.|物体识别、天气、周边店铺和附近自行车邀约均为模拟。角色是屏幕上的 2D AR 叠加，并未固定在现实空间中。
카메라는 버튼을 누른 뒤에만 켜집니다. 촬영 버튼으로 남긴 사진과 위치 기록은 이 브라우저에만 보관하며 서버로 전송하지 않습니다. 마이크는 사용하지 않습니다.|The camera starts only after you tap its button. Photos you capture and location records stay in this browser and are not uploaded. No microphone is used.|相机只会在点击按钮后开启。拍摄的照片和位置记录仅保存在当前浏览器，不上传服务器，也不使用麦克风。
닫기|Close|关闭
오늘은,|Today,|今天，
누구와|who's|和谁
 달릴까요?| coming along?|一起骑行？
오늘, 누구와 달릴까요?|Who will you ride with today?|今天，和谁一起骑行？
같은 길도, 함께하는 소울에 따라 새로운 이야기가 돼요.|The same road becomes a new story with a different Soul.|同一条路，和不同灵魂同行，也会遇见新的故事。
자전거에 깃든 작은 영혼을 만나보세요.|Meet the little Soul living in your bicycle.|来认识住在自行车里的小小灵魂。
자전거 QR 스캔하기|Scan a bike's QR|扫描自行车二维码
QR을 비추면 자전거의 소울이 깨어나요.|Scan the QR to wake your bicycle's Soul.|扫描二维码，唤醒自行车的灵魂。
당신을 기다리는 세 친구|Three friends waiting for you|三个朋友，正在等你
근처 초대 · 데모|Nearby invitations · Demo|附近邀约 · 演示
세 가지 성격의 소울|Three Soul personalities|三种性格的灵魂
호기심 많은 소울|The curious Soul|好奇型灵魂
느긋한 소울|The easygoing Soul|悠闲型灵魂
먹보 소울|The foodie Soul|吃货型灵魂
호기심형|Curious|好奇型
여유형|Easygoing|悠闲型
먹보형|Foodie|吃货型
저 모퉁이 너머엔 뭐가 있을까?|I wonder what's around that corner.|那个转角后面，会有什么呢？
서두르지 않아도 괜찮아. 나랑 갈래?|No need to hurry. Want to ride with me?|不用着急。要和我一起走吗？
맛있는 이야기는 내가 준비했어!|I've got some delicious stories ready!|美味的故事，我已经准备好啦！
작은 발견에도 눈을 반짝이는 친구|A friend who lights up at little discoveries|连小小发现都会让它眼睛发亮的朋友
바람과 햇살의 속도를 아는 친구|A friend in tune with the breeze and sunshine|懂得风和阳光节奏的朋友
골목마다 맛있는 상상을 하는 친구|A friend who finds tasty possibilities everywhere|每条巷子都能勾起美食想象的朋友
QR 저장하기|Save QR|保存二维码
QR로 깨우고|Wake them with a QR|用二维码唤醒
목소리로 함께하고|Ride with their voice|听着声音同行
우리의 기록으로 남아요|Keep a shared memory|留下我们的记录
단순히 빌리는 자전거가 아니라, 다시 만나고 싶은 동반자.|A bicycle to borrow. A companion to meet again.|不只是租来的自行车，更是期待再次相遇的伙伴。
세 친구의 성격과 작은 초대를 먼저 체험해보세요.|Get to know the three friends and their invitations.|先来体验三位朋友的性格与小小邀约。
소울 만나기로|Back to Souls|返回灵魂列表
01 만나기|01 Meet|01 相遇
02 함께 달리기|02 Ride together|02 一起骑行
03 기억 남기기|03 Remember|03 留下回忆
자전거 안에,|Inside your bicycle,|自行车里，
작은 친구가 있어요.|a little friend awaits.|住着一个小伙伴。
QR이 연결해 준 오늘의 동반자. 카메라를 열면, 소울이 당신의 세상 위로 살짝 고개를 내밀어요.|Your QR has found today's companion. Open the camera and let your Soul peek into your world.|二维码为你找到了今天的伙伴。打开相机，灵魂会悄悄探头，来到你的世界。
카메라와 음성으로 소울 만나기|Meet with camera + voice|相机＋语音陪伴
카메라 없이 미리 만나기|Preview without a camera|无需相机，先见一面
다음 화면에서 카메라를 켜면 권한을 요청해요.|On the next screen, enabling the camera asks for permission.|在下一页开启相机时，会请求使用权限。
카메라 입장 시 마이크를 켜고, 음성과 AI 관찰 화면을 Qwen에 보내 대화해요. 녹음 파일은 저장하지 않아요.|Entering the camera sends microphone audio and AI observation frames to Qwen. Recordings are not saved.|进入相机后将麦克风声音和 AI 观察画面发送给千问，不保存录音文件。
실시간 후면 카메라|Live rear camera|实时后置相机
자전거의 QR을 비춰주세요|Point at your bike's QR|请对准自行车二维码
당신의 세상으로 초대해요|Invite a Soul into your world|邀请灵魂来到你的世界
카메라를 켜고 세 소울의 QR 코드 중 하나를 화면 안에 담아주세요.|Enable the camera and frame one of the three Soul QR codes.|开启相机，将三个灵魂的任意一个二维码放进画面。
카메라를 켜면 화면 위로 소울이 나타나요.|Enable your camera to meet a Soul on screen.|开启相机，灵魂就会出现在画面上。
VELO SOUL 전용 QR 인식|VELO SOUL QR scanner|VELO SOUL 专属二维码识别
화면 위의 작은 동반자 · 2D AR|Your on-screen companion · 2D AR|屏幕上的小伙伴 · 2D AR
당신의 세상으로.|into your world.|来到你的世界。
주변이 궁금한 루미는 가장자리에서 빼꼼. 같은 풍경을 바라보는 순간, 우리의 여정이 시작돼요.|Curious Lumi peeks in from the edge. Our journey begins when we look at the world together.|好奇的露米从屏幕边缘探出头。当我们望向同一片风景，旅程就开始了。
서두르지 않는 모리가 천천히 둥둥 떠올라요. 오늘은 서로의 속도에 맞춰 달려볼까요?|Unhurried Mori gently floats into view. Shall we find a pace that feels right for both of us?|不慌不忙的莫里缓缓漂浮出现。今天，要不要按照彼此舒服的速度骑行？
맛있는 상상으로 가득한 보리가 화면 한가운데로 찾아와요. 오늘은 어떤 이야기가 기다릴까요?|Full of delicious daydreams, Bori pops into the center. What stories await today?|满脑子美食想象的波里来到屏幕中央。今天，会有什么故事在等着我们？
버튼을 누르면 브라우저에서 카메라 권한을 요청해요. 영상은 서버로 보내지 않아요.|Tap the button to request camera access. Video is not sent to a server.|点击按钮后，浏览器会请求相机权限。视频不会上传服务器。
카메라 켜기|Enable camera|开启相机
미리보기로 깨우기|Wake in preview|在预览中唤醒
카메라는 아직 꺼져 있어요.|Your camera is still off.|相机尚未开启。
QR 안의 소울을|Shall we wake|要不要唤醒
깨워볼까요?|the Soul in this QR?|二维码里的灵魂？
자전거마다 다른 성격, 다른 색의 QR. 휴대폰 기본 카메라로도 바로 소울의 페이지를 열 수 있어요.|Each bike has its own personality and QR color. Your phone's camera can also open a Soul's page directly.|每辆自行车都有独特的性格和二维码颜色。也可以使用手机自带相机直接扫码进入。
자전거 QR 스캔|Scan a bike QR|扫描自行车二维码
세 가지 소울 중 한 친구를 만나요|Meet one of the three Souls|认识三个灵魂中的一位
카메라 켜고 스캔하기|Enable camera & scan|开启相机并扫码
목록에서 소울 직접 선택하기|Choose from the Soul list|从列表直接选择灵魂
카메라를 켜면 QR 인식을 시작해요.|Enable the camera to start scanning.|开启相机后开始识别二维码。
권한 요청 중…|Waiting for permission…|正在等待授权…
카메라 끄기|Turn camera off|关闭相机
소울 깨우기|Wake your Soul|唤醒灵魂
다시 인사 듣기|Hear the greeting again|再听一次问候
카메라 화면 위에 소울이 나타났어요.|Your Soul is here on the camera view.|灵魂已经出现在相机画面中。
카메라 없는 애니메이션 미리보기예요.|This is an animation preview without a camera.|这是未使用相机的动画预览。
VELO SOUL의 전용 QR 코드를 비춰주세요.|Please scan a VELO SOUL QR code.|请扫描 VELO SOUL 专属二维码。
위치 기록을 켜면 실제 이동 경로가 남아요.|Enable location tracking to record your real route.|开启位置记录，即可留下真实骑行轨迹。
좋아, 출발하자. 나는 네 곁에 있을게.|Let's go. I'll be right here with you.|好，出发吧。我会一直陪在你身边。
GPS로 기록한 이동 궤적|Your recorded GPS trail|GPS 记录的移动轨迹
아직 기록된 이동 경로가 없음|No route recorded yet|尚未记录移动轨迹
아직 그려진 경로가 없어요|No route recorded yet|还没有留下轨迹
GPS를 켜고 함께 달려주세요|Enable GPS and ride together|开启 GPS，一起骑行吧
실제 기록 / 도로 지도 아님|Recorded trail / not a road map|真实轨迹／非道路地图
위치 기록 대기|Waiting for location|等待位置记录
다시 듣기|Listen again|再听一次
카메라 · 순간 담기|Camera · Capture a moment|相机 · 记录瞬间
목소리 쉬기|Pause voice|暂停声音
목소리 켜기|Enable voice|开启声音
우리의 지금|Our ride right now|我们的此刻
함께한 시간|Time together|同行时间
거리 · km|Distance · km|距离 · km
GPS 속도 · km/h|GPS speed · km/h|GPS 速度 · km/h
위치 기록 켜기|Enable GPS tracking|开启位置记录
상황 시뮬레이션|Simulated scenario|情景模拟
카메라로 발견해요|Discover through the camera|通过相机发现世界
날씨와 속도를 느껴요|Feel the weather and pace|感受天气与速度
GPS로 가까운 장소를 만나요|Meet nearby places with GPS|用 GPS 发现已收录的附近地点
실제 영상의 사물을 자동 인식하지 않아요.|Objects in the live video are not automatically recognized.|不会自动识别真实视频中的物体。
GPS를 켜면 주변 날씨와 속도를 자동으로 확인해요.|GPS automatically checks local weather and speed.|开启 GPS 后自动获取当地天气与速度。
가게 정보와 추천은 예시이며 실제 주변 검색이 아니에요.|Shops and recommendations are examples, not live nearby results.|店铺和推荐为示例，并非真实的附近搜索结果。
소울과 고른 순간|Moments with your Soul|和灵魂一起挑选的瞬间
잠깐 멈춰서, 함께 기억할 장면을 담아요.|Pause for a moment and capture a shared memory.|先停下来，拍下值得一起记住的画面。
여정 마치고 기록 남기기|Finish & make a memory|结束旅程，留下记录
주행 중에는 화면 대신 목소리에 귀 기울여요.|While riding, enjoy the voice and keep your eyes on the road.|骑行时聆听声音，视线留在道路上。
위치 기록을 잠시 멈췄어요.|Location tracking is paused.|位置记录已暂停。
이 환경에서는 위치를 사용할 수 없어요. HTTPS 주소를 휴대폰에서 열어주세요.|Location is unavailable here. Open the HTTPS address on your phone.|此环境无法使用定位。请在手机中打开 HTTPS 网址。
위치 권한과 GPS 신호를 기다리고 있어요.|Waiting for location permission and a GPS signal.|正在等待位置授权和 GPS 信号。
이번 체험의 위치 기록 한도에 도달했어요. 지금까지의 경로는 남아 있어요.|This session's tracking limit is reached. Your route so far is kept.|本次体验的位置记录已达上限，已有轨迹仍会保留。
실제 GPS 속도 · 모리의 제안|Live GPS speed · Mori's suggestion|实际 GPS 速度 · 莫里的建议
위치 권한이 꺼져 있어요. 브라우저 사이트 설정에서 허용한 뒤 다시 시도해주세요.|Location access is off. Allow it in your browser's site settings and retry.|位置权限未开启。请在浏览器的网站设置中允许后重试。
위치 신호를 찾지 못했어요. 실외에서 다시 시도해주세요.|No location signal. Please try again outdoors.|未获取到位置信号，请到室外重试。
위치 기록 멈추기|Pause GPS tracking|暂停位置记录
소울과 순간 담기|Capture a moment with your Soul|和灵魂一起记录瞬间
함께 기억할 순간|A moment to remember|一起珍藏的瞬间
카메라 닫기|Close camera|关闭相机窗口
순간 담기|Capture a moment|记录瞬间
잠깐 멈춘 뒤 카메라를 켜주세요.|Stop riding before enabling the camera.|请先停下来，再开启相机。
소울과 함께한 장면을 담았어요.|Your shared moment is captured.|已经记录下和灵魂相伴的瞬间。
오늘 체험에서는|In today's demo,|在今天的体验中，
우리가 골라 담은 장면도 여기 남겨 둘게.|I'll keep the moments we captured here, too.|我们一起拍下的瞬间，也留在这里吧。
오늘은 네가 내 곁에 있었어.|Today, you were by my side.|今天，有你陪在我身边。
고른 시뮬레이션 상황을 바탕으로 쓴 소울의 후기예요.|Your Soul's reflection includes the simulated scenarios you chose.|这篇灵魂感想包含你选择的模拟情景。
이번 여정에는 사진을 담지 않았어요.|No photos were taken on this ride.|本次旅程还没有拍下照片。
소울의 기분 카드|Your Soul's mood card|灵魂心情卡
이미지로 저장|Save as image|保存为图片
기록 삭제|Delete memory|删除记录
길은 끝나도,|The ride ends,|路途结束了，
우리의 이야기는 남아요.|our story stays.|我们的故事还在。
당신의 한마디|Your note|你的一句话
선택 · 160자|Optional · 160 characters|选填 · 160 字
오늘 소울은 어떤 존재로 느껴졌나요?|What did your Soul feel like to you today?|今天，灵魂让你感到它是怎样的存在？
우리의 기록에 남기기|Save to our journal|保存到我们的记录
카드 이미지로 저장|Save the card as an image|将卡片保存为图片
사진과 GPS 경로는 이 브라우저에만 저장돼요. 다른 사람에게 자동으로 공유되지 않아요.|Photos and GPS trails stay in this browser. They are not automatically shared.|照片和 GPS 轨迹仅保存在当前浏览器，不会自动分享给其他人。
기록하지 않고 돌아가기|Return without saving|不保存，直接返回
우리의 기록에 남겼어요.|Saved to our journal.|已保存到我们的记录。
이 브라우저에 저장하지 못했어요. 카드 이미지로 먼저 보관해주세요.|Couldn't save in this browser. Download the card image to keep it.|无法保存到当前浏览器，请先下载卡片图片留存。
우리가 함께한 순간.|The moments we shared.|我们一起经历的瞬间。
소울의 시선으로 남긴 작은 라이딩 일기. 이 기기에서만 볼 수 있어요.|Little ride diaries through your Soul's eyes. Available only on this device.|从灵魂视角留下的小小骑行日记，仅在本机可见。
기억을 불러오는 중…|Loading memories…|正在加载回忆…
첫 번째 이야기를 기다려요.|Your first story awaits.|期待第一个故事。
소울과 함께 달리고, 우리의 순간을 남겨보세요.|Ride with a Soul and keep a moment together.|和灵魂一起骑行，留下属于我们的瞬间。
소울 만나러 가기|Meet a Soul|去遇见灵魂
여정 카드를 만들고 있어요.|Creating your journey card.|正在制作旅程卡片。
위치 기록 없이 함께한 여정|A journey without GPS tracking|未开启位置记录的旅程
기록된 경로 없음|No recorded route|没有记录轨迹
시뮬레이션 상황을 포함한 체험 후기|Reflection includes simulated scenarios|体验感想包含模拟情景
여정 카드 이미지를 저장했어요.|Your journey card image is saved.|旅程卡片图片已保存。
이미지를 만들지 못했어요. 다시 시도해주세요.|Couldn't create the image. Please try again.|无法生成图片，请重试。
아직 저장하지 않은 여정이 있어요. 기록하지 않고 나갈까요?|Your journey hasn't been saved. Leave without saving?|旅程尚未保存。确定不保存就离开吗？
이 기기에 저장한 여정과 사진을 삭제할까요?|Delete this journey and its photos from this device?|删除本机保存的这段旅程和照片吗？
기록을 삭제했어요.|Memory deleted.|记录已删除。
기록을 삭제하지 못했어요.|Couldn't delete this memory.|未能删除记录。
카메라를 껐어요.|Camera turned off.|相机已关闭。
조용히 곁에 있을게.|I'll stay quietly by your side.|我会安静地陪着你。
화면을 떠나 카메라를 껐어요. 다시 켜려면 버튼을 눌러주세요.|The camera stopped when you left the page. Tap to enable it again.|离开页面后，相机已关闭。点击按钮即可重新开启。
카메라 다시 켜기|Restart camera|重新开启相机
화면을 떠나 위치 기록을 멈췄어요. 다시 켜서 이어갈 수 있어요.|Location tracking paused when you left the page. Enable it to continue.|离开页面后，位置记录已暂停。重新开启即可继续。
목소리를 쉬고 있어요.|Voice is paused.|声音已暂停。
목소리를 준비하고 있어요…|Getting the voice ready…|正在准备声音…
소리를 재생하지 못했어요. 다시 듣기를 눌러주세요.|Couldn't play the audio. Tap Listen again.|无法播放声音，请点击“再听一次”。
한국어 목소리 재생 중|Playing Korean audio|正在播放韩语语音
다시 듣기로 목소리를 들을 수 있어요.|Tap Listen again to hear the voice.|点击“再听一次”即可播放声音。
불러오기가 지연돼요. 다시 듣기를 눌러주세요.|Audio is taking a while. Tap Listen again.|音频加载较慢，请点击“再听一次”。
이 기기에 한국어 읽기 음성이 없어요. 이 상황은 자막으로 체험해요.|This device has no Korean speech voice. Enjoy this scene with subtitles.|此设备没有韩语朗读语音，请通过字幕体验此情景。
기기의 한국어 음성으로 읽는 중|Reading with the device's Korean voice|正在使用设备的韩语语音朗读
다시 듣기로 들을 수 있어요.|Tap Listen again to replay.|点击“再听一次”即可重播。
이 기기는 추가 상황의 음성 읽기를 지원하지 않아요. 자막으로 체험해주세요.|This device can't read additional scenarios aloud. Please use the subtitles.|此设备不支持朗读新增情景，请通过字幕体验。
카메라를 지원하는 휴대폰 브라우저에서 HTTPS 주소를 열어주세요. 미리보기로도 체험할 수 있어요.|Open the HTTPS address in a camera-enabled phone browser, or try the preview.|请在支持相机的手机浏览器中打开 HTTPS 网址，也可以先体验预览。
브라우저의 카메라 권한 안내에서 허용을 선택해주세요.|Choose Allow in your browser's camera permission prompt.|请在浏览器的相机权限提示中选择“允许”。
카메라 연결이 끝났어요. 다시 켤 수 있어요.|The camera disconnected. You can enable it again.|相机连接已结束，可以重新开启。
카메라가 켜졌어요.|Your camera is on.|相机已开启。
카메라 사용이 허용되지 않았어요. 주소창의 사이트 설정에서 허용한 뒤 다시 켜주세요.|Camera access wasn't allowed. Enable it in the address bar's site settings, then try again.|相机访问未获允许。请在地址栏的网站设置中允许后重新开启。
사용할 수 있는 카메라가 없어요. 미리보기로 소울을 만나보세요.|No camera is available. Meet your Soul in preview.|没有可用的相机。可以通过预览遇见灵魂。
카메라를 열 수 없어요. 다른 앱에서 사용 중인지 확인해주세요.|Couldn't open the camera. Check whether another app is using it.|无法打开相机，请检查是否被其他应用占用。
카메라를 시작하지 못했어요. 다시 시도하거나 미리보기로 계속해주세요.|Couldn't start the camera. Retry or continue in preview.|相机启动失败，请重试或通过预览继续。
특이한 색의 차|An unusual car color|特别颜色的汽车
보라색 자동차 발견|A purple car!|发现紫色汽车
저 보라색 차 봤어? 포도알이 바퀴를 달고 가는 것 같아! 잠깐 멈춰서 같이 볼까?|See that purple car? Like a grape on wheels! Shall we stop and take a look?|看到那辆紫色的车了吗？像一颗装了轮子的葡萄！要不要停下来一起看看？
보라색 자동차를 상상하며 한참 웃었어.|Imagining a purple car made me smile.|想象着紫色汽车，我们笑了好一会儿。
빛과 그림자|Light and shadow|光与影
나뭇잎 그림자 발견|Leaf shadows|发现树叶的影子
나뭇잎 그림자를 따라 작은 모험을 했어.|We took a little adventure with the leaf shadows.|我们跟着树叶的影子，来了一场小冒险。
빠른 속도|A faster pace|速度有点快
조금만 천천히|A little slower|稍微慢一点
조금 빠르게 달리고 있네. 괜찮다면 우리, 속도를 낮추고 바람을 느껴볼까?|We're going a little fast. How about slowing down and feeling the breeze?|我们骑得有点快啦。要不要慢下来，感受一下风？
서로의 속도를 맞춰 보는 시간이 좋았어.|I liked finding a pace that worked for us both.|喜欢和你一起找到舒服的节奏。
맑은 날씨|A sunny day|晴朗天气
햇살 좋은 오후|A sunny afternoon|阳光明媚的午后
햇살이 참 포근해. 다음에는 강가의 나무 그늘에서 잠깐 쉬어 갈까?|The sunshine feels so warm. Shall we rest in the shade by the river next time?|阳光真暖。下次要不要在河边的树荫下休息一会儿？
따뜻한 햇살과 강가의 그늘을 상상했어.|I imagined warm sunshine and shade by the river.|我想象着温暖的阳光与河畔的树荫。
카페 근처|Near a café|路过咖啡店
골목의 작은 카페|A little alley café|巷子里的小咖啡店
저 골목에 카페가 있다고 상상해 봐! 잠깐 쉬면서 따뜻한 빵 한 입, 어때?|Imagine a café down that alley! How about a break and a bite of warm bread?|想象那条巷子里有一家咖啡店！休息一下，吃一口热面包，怎么样？
작은 카페에서 쉬어 가는 상상을 했어.|I imagined a cozy break at a little café.|我想象着在小咖啡店休息的时光。
배고픈 순간|Feeling hungry|有点饿了
슬슬 출출하지 않아?|Getting hungry yet?|是不是有点饿啦？
빵 이야기를 나누니 평범한 길도 맛있어졌어.|Our bread stories made an ordinary road delicious.|聊起面包，普通的路也变得美味了。
안녕, 나는 이 자전거에 사는 루미야. 네가 보는 풍경을 나도 함께 보고 싶어.|Hey, I'm Lumi! I live in this bike. Wanna see what's around the corner?|你好，我是住在这辆自行车里的露米。我也想和你一起看风景。
방금 나뭇잎 그림자가 바퀴를 따라 움직였어. 이런 작은 발견이 나는 참 좋아.|The leaf shadows were moving with our wheels. I love little discoveries like that.|刚才树叶的影子跟着车轮一起移动呢。我最喜欢这样的小发现了。
나 여기 있어. 잠깐 말 없이 같이 달려도 좋아.|I'm here. We can ride quietly for a while.|我在这里。安静地一起骑一会儿，也很好。
오늘 네 옆에서 달린 시간이 내게는 작은 모험이었어.|Riding beside you today felt like a little adventure.|今天在你身旁骑行的时光，对我来说是一场小小冒险。
호기심이 반짝이는 중|Sparkling with curiosity|好奇心正在闪闪发亮
너와 나란히 달리는 동안 세상이 조금 더 궁금해졌어. 다음엔 어떤 장면을 함께 만나게 될까?|Riding beside you made me even more curious about the world. What will we discover next time?|和你并肩骑行，让我对世界更加好奇。下次又会一起遇见怎样的风景呢？
안녕, 나는 이 자전거에 사는 모리야. 오늘은 네 속도에 맞춰서 같이 갈게.|Hello, I'm Mori. I live in this bicycle. No rush today. We'll find our own pace.|你好，我是住在这辆自行车里的莫里。今天，我会按照你的速度同行。
바람이 잠깐 스쳐 갔네. 아무 말 없이 달리는 시간도 나는 좋아.|A breeze just passed by. I like our quiet moments on the road, too.|刚才有一阵风轻轻吹过。我也喜欢不说话、一起骑行的时光。
응, 조용히 곁에 있을게. 필요하면 다시 불러줘.|Sure, I'll stay quietly beside you. Call me when you need me.|好，我会安静地陪着你。需要时再叫我吧。
같이 달리니 평범한 오후가 조금 따뜻해졌어.|Riding together made an ordinary afternoon feel warmer.|和你一起骑行，让平凡的午后也温暖了一点。
마음까지 느긋해졌어|Feeling peaceful inside|连心情也放松下来了
빠르게 도착하는 것보다 네 곁에 머무는 시간이 좋았어. 말 없이 함께한 순간도 오래 기억할게.|I enjoyed being beside you more than arriving quickly. I'll remember our quiet moments, too.|比起快点到达，我更喜欢陪在你身旁的时间。那些安静相伴的瞬间，我也会记很久。
안녕, 나는 이 자전거에 사는 보리야. 오늘도 같이 달릴 친구를 기다리고 있었어.|Hey, I'm Bori! I've been saving you a spot. Ready for a ride, and maybe a little snack?|你好，我是住在这辆自行车里的波里。今天也一直在等一起骑行的朋友。
따뜻한 빵 냄새를 상상했더니 기분이 좋아졌어. 너랑 같이 달려서 그런가?|Imagining warm bread made me happy. Or maybe it's because I'm riding with you?|想象着热面包的香气，心情就变好了。也许是因为和你一起骑行吧？
좋아, 지금은 조용히 함께할게. 빵 이야기는 나중에 해도 되니까!|Okay, let's enjoy a quiet moment. We can talk about bread later!|好，现在就安静地陪着你。面包的故事，之后再聊也可以！
오늘 우리 같이 보낸 시간이 제일 맛있는 기억이 될 것 같아.|Our time together today might be my most delicious memory.|今天和你共度的时光，大概会成为最美味的回忆。
함께라서 배부른 마음|A heart full of togetherness|因为相伴，心里满满的
오늘 가장 맛있는 기억은 너랑 같이 달린 시간이야. 다음번에도 내 옆자리를 비워 둘게!|My tastiest memory today is riding with you. I'll save a spot by my side for next time!|今天最美味的回忆，就是和你一起骑行的时间。下次也会为你留着身旁的位置！
루미|Lumi|露米
모리|Mori|莫里
보리|Bori|波里
`.trim().split('\n').filter(line=>line.trim()).map(line=>line.split('|'));

const names={ko:['루미','모리','보리'],en:['Lumi','Mori','Bori'],zh:['露米','莫里','波里']};
const name=(s,lang)=>names[lang][names.ko.indexOf(s)]||s;
const dynamic=[
 ['안녕, 나는 (루미|모리|보리)야\\.',n=>`Hi, I'm ${n}.`,n=>`你好，我是${n}。`],
 ['(루미|모리|보리)와 함께 달리는 중',n=>`Riding with ${n}`,n=>`正在和${n}一起骑行`],
 ['(루미|모리|보리)와 출발하기',n=>`Ride with ${n}`,n=>`和${n}一起出发`],
 ['(루미|모리|보리) 만나기',n=>`Meet ${n}`,n=>`遇见${n}`],
 ['(루미|모리|보리)의 초대 듣기',n=>`Hear ${n}'s invitation`,n=>`听听${n}的邀约`],
 ['(루미|모리|보리) 전용 QR 코드',n=>`${n}'s QR code`,n=>`${n}专属二维码`],
 ['(루미|모리|보리)에게 바로 연결되는 QR',n=>`Your QR to meet ${n}`,n=>`扫码直接遇见${n}`],
 ['(루미|모리|보리) 깨우기',n=>`Wake ${n}`,n=>`唤醒${n}`],
 ['(루미|모리|보리)가,',n=>`${n},`,n=>`${n}，`],
 ['(루미|모리|보리)의 등장 애니메이션',n=>`${n}'s entrance animation`,n=>`${n}的登场动画`],
 ['(루미|모리|보리)의 QR을 찾았어요!',n=>`Found ${n}'s QR!`,n=>`找到${n}的二维码啦！`],
 ['곁에 있는 (루미|모리|보리)',n=>`${n} by your side`,n=>`陪在身旁的${n}`],
 ['(루미|모리|보리)의 목소리',n=>`${n}'s voice`,n=>`${n}的声音`],
 ['상황을 골라 (루미|모리|보리)의 반응을 들어보세요\\.',n=>`Choose a scenario to hear ${n}'s response.`,n=>`选择情景，听听${n}的反应。`],
 ['(루미|모리|보리)의 라이딩 일기',n=>`${n}'s ride diary`,n=>`${n}的骑行日记`],
 ['(루미|모리|보리)의 기분 카드',n=>`${n}'s mood card`,n=>`${n}的心情卡`],
 ['(루미|모리|보리)가 오늘의 여정을 한 장의 일기로 남겼어요\\. 당신의 한마디도 더해볼까요\\?',n=>`${n} made a diary of today's journey. Would you like to add a note?`,n=>`${n}把今天的旅程写成了日记。也加上你的一句话吧？`]
].map(([pattern,en,zh])=>[new RegExp(pattern,'g'),en,zh]);
const catalog=Object.fromEntries(rows.map(([ko,en,zh])=>[ko,{ko,en,zh}]));
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const matcher=new RegExp(Object.keys(catalog).sort((a,b)=>b.length-a.length).map(escapeRegex).join('|'),'g');
const storeKey='velo-soul-ui-language';
let language='ko';
export function getLanguage(){return language;}
export function locale(){return {ko:'ko-KR',en:'en-US',zh:'zh-CN'}[language];}
export function translate(value,lang=language){
 let text=String(value??'');if(lang==='ko'||!['en','zh'].includes(lang))return text;
 for(const [pattern,en,zh] of dynamic)text=text.replace(pattern,(_,n)=>(lang==='en'?en:zh)(name(n,lang)));
 text=text.replace(/사진 (\d+)장/g,(_,n)=>lang==='en'?`Photos ${n}`:`照片 ${n} 张`)
 .replace(/GPS 오차가 커서 기다리는 중이에요 \(±(\d+)m\)\./g,(_,n)=>lang==='en'?`Waiting for better GPS accuracy (±${n}m).`:`GPS 误差较大，等待更准确信号（±${n} 米）。`)
 .replace(/실제 GPS 기록 중 · 정확도 ±(\d+)m/g,(_,n)=>lang==='en'?`Live GPS tracking · Accuracy ±${n}m`:`实际 GPS 记录中 · 精度 ±${n} 米`)
 .replace(/소울과 함께 담은 장면 (\d+)/g,(_,n)=>lang==='en'?`Scene with your Soul ${n}`:`和灵魂一起记录的画面 ${n}`)
 .replace(/함께 담은 순간 (\d+)/g,(_,n)=>lang==='en'?`Shared moment ${n}`:`一起记录的瞬间 ${n}`)
 .replace(/(\d+)월 (\d+)일/g,(_,m,d)=>lang==='en'?new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',timeZone:'UTC'}).format(Date.UTC(2026,+m-1,+d)):`${m}月${d}日`);
 return text.replace(matcher,source=>catalog[source][lang]);
}

export function startLanguageUI(doc=document){
 try{const saved=localStorage.getItem(storeKey);if(['en','ko','zh'].includes(saved))language=saved;}catch{}
 const sources=new WeakMap(),attrs=new WeakMap();
 const ignored=el=>el?.closest('script,style,[data-no-translate],.post-note');
 function textNode(node){if(ignored(node.parentElement)||node.parentElement?.closest('textarea,input,select'))return;const current=node.nodeValue;let record=sources.get(node);if(!record||current!==record.output)record={source:current};const output=translate(record.source);record.output=output;sources.set(node,record);if(current!==output)node.nodeValue=output;}
 function element(el){if(ignored(el))return;for(const attr of ['aria-label','placeholder','alt','title']){if(!el.hasAttribute(attr))continue;let map=attrs.get(el);if(!map){map={};attrs.set(el,map);}const current=el.getAttribute(attr);let record=map[attr];if(!record||current!==record.output)record={source:current};record.output=translate(record.source);map[attr]=record;if(current!==record.output)el.setAttribute(attr,record.output);}if(el.matches('textarea')&&el.hasAttribute('placeholder'))return;}
 function visit(root){if(root.nodeType===3){textNode(root);return;}if(root.nodeType!==1&&root.nodeType!==9)return;if(root.nodeType===1){if(root.matches('script,style,[data-no-translate],.post-note'))return;element(root);if(root.matches('textarea,input,select'))return;}for(const child of root.childNodes)visit(child);}
 const observer=new MutationObserver(changes=>{observer.disconnect();for(const change of changes){if(change.type==='childList')change.addedNodes.forEach(visit);else if(change.type==='characterData')textNode(change.target);else element(change.target);}observe();});
 function observe(){observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','alt','title']});}
 function apply(){observer.disconnect();doc.documentElement.lang=locale();doc.querySelector('#languageSelect').value=language;visit(doc.documentElement);observe();}
 doc.querySelector('#languageSelect').addEventListener('change',e=>{const next=e.target.value;if(!['en','ko','zh'].includes(next))return;language=next;try{localStorage.setItem(storeKey,language);}catch{}apply();});
 apply();
 return {refresh:apply};
}
