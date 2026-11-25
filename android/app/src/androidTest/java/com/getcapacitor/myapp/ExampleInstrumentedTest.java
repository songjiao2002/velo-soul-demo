package com.getcapacitor.myapp;

import static org.junit.Assert.*;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.velosoul.companion.MainActivity;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import android.view.accessibility.AccessibilityNodeInfo;
import android.accessibilityservice.AccessibilityServiceInfo;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Tests the actual bundled Android WebView. No voice or camera data leaves the emulator. */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

    private String js(String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        activity.getScenario().onActivity(a -> a.getBridge().getWebView().evaluateJavascript(script, value -> {result.set(value);done.countDown();}));
        assertTrue("JavaScript callback", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void awaitTrue(String expression) throws Exception {
        long end=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<end){if("true".equals(js("Boolean("+expression+")")))return;Thread.sleep(200);}
        fail("Timed out: "+expression+"; startup="+js("document.querySelector('#startupError')?.textContent"));
    }
    private void allowCameraPermission() throws Exception {
        var automation=InstrumentationRegistry.getInstrumentation().getUiAutomation();
        var info=automation.getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        automation.setServiceInfo(info);
        long until = System.currentTimeMillis()+15000;
        while(System.currentTimeMillis()<until) {
            AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
            if(root!=null) {
                for(String controller:new String[]{"com.android.permissioncontroller","com.google.android.permissioncontroller"})
                for(String id:new String[]{"permission_allow_foreground_only_button","permission_allow_one_time_button","permission_allow_button"}) {
                    var matches=root.findAccessibilityNodeInfosByViewId(controller+":id/"+id);
                    for(var node:matches)if(node.isClickable()){node.performAction(AccessibilityNodeInfo.ACTION_CLICK);return;}
                }
            }
            Thread.sleep(200);
        }
        fail("Camera permission dialog did not appear");
    }
    @Test public void bundledAppScannerAndCompanionWork() throws Throwable {
        try { verifyBundledApp(); }
        catch (Throwable failure) { android.util.Log.e("VeloDeviceTest", "Device assertion failed before activity cleanup", failure); throw failure; }
    }
    private void verifyBundledApp() throws Exception {
        assertEquals("com.velosoul.companion",InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        awaitTrue("document.body.dataset.screen === 'companions' && document.querySelector('#startupNotice').hidden");
        assertEquals("true",js("window.isSecureContext && Capacitor.isNativePlatform() && !!navigator.mediaDevices?.getUserMedia"));
        js("window.__vadAsset=null; fetch('/vendor/rnnoise/rnnoise.wasm').then(r=>r.arrayBuffer()).then(b=>WebAssembly.compile(b)).then(m=>window.__vadAsset=WebAssembly.Module.exports(m).some(e=>e.name==='rnnoise_process_frame')).catch(e=>window.__vadAsset=String(e))");
        awaitTrue("window.__vadAsset === true");
        assertEquals("3",js("document.querySelectorAll('.app-tabbar button').length"));
        assertEquals("true",js("document.documentElement.classList.contains('native-app') && getComputedStyle(document.querySelector('.status-bar')).display === 'none' && getComputedStyle(document.querySelector('.gesture-area')).display === 'none'"));
        assertEquals("1",js("document.querySelectorAll('.app-tabbar [data-nav=companions]').length"));
        assertEquals("0",js("document.querySelectorAll('.soul-card,.topbar').length"));
        js("document.querySelector('[data-companion-profile=mori]').click()");
        assertEquals("true",js("!document.querySelector('[data-companion-card=mori]').hidden && document.querySelector('[data-companion-card=lumi]').hidden"));
        js("document.querySelector('[data-action=settings]').click();document.querySelector('input[name=voiceSelectChoice][value=zh]').click();document.querySelector('[data-save-settings]').click();document.querySelector('[data-action=settings]').click()");
        assertEquals("true",js("document.querySelector('input[name=voiceSelectChoice][value=zh]').checked && document.querySelector('#voiceSelect').value === 'zh'"));
        js("document.querySelector('[data-action=settings-close]').click()");
        js("document.querySelector('.app-tabbar [data-action=scan]').click()");
        awaitTrue("document.body.dataset.screen === 'scan' && !!window.jsQR && !!document.querySelector('#cameraStart')");
        assertEquals("true",js("!!document.querySelector('.scan-history-card') && !!document.querySelector('.scan-home > .scan-home-action')"));
        assertEquals("true",js("Capacitor.isPluginAvailable('VeloMedia')"));
        // Exercise a real first-use runtime permission and the emulator camera.
        js("document.querySelector('#cameraStart').click()");
        allowCameraPermission();
        awaitTrue("document.querySelector('#cameraView').classList.contains('live') && document.querySelector('#cameraVideo').videoWidth > 0");
        assertEquals("true",js("document.querySelector('#cameraVideo').muted && document.querySelector('#cameraVideo').playsInline"));
        js("window.__cameraTrack=document.querySelector('#cameraVideo').srcObject.getVideoTracks()[0];document.querySelector('#cameraStart').click()");
        awaitTrue("window.__cameraTrack.readyState === 'ended' && !document.querySelector('#cameraVideo').srcObject");
        js("window.__qrCheck=null;(async()=>{try{const answers=[];for(const id of ['lumi','bori','mori']){const image=new Image();image.src='/qr-'+id+'.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const code=jsQR(pixels.data,canvas.width,canvas.height);answers.push(code?.data==='https://velo-soul-demo-production.up.railway.app/?bike='+id+'&qr='+({lumi:'m2-6d81c29a',bori:'p2-a37e50b4',mori:'l2-942fb6e8'})[id]);}window.__qrCheck=answers.every(Boolean);}catch(e){window.__qrCheck=String(e);}})()");
        awaitTrue("window.__qrCheck === true");
        js("document.querySelector('.app-tabbar [data-action=scan]').click()");
        awaitTrue("document.body.dataset.screen === 'scan'");
        js("window.jsQR=()=>({data:'https://velo-soul-demo-production.up.railway.app/?bike=mori&qr=l2-942fb6e8'});document.querySelector('#cameraStart').click()");
        awaitTrue("document.body.dataset.screen === 'welcome' && location.search === '?bike=mori&qr=l2-942fb6e8'");
        assertEquals("true",js("document.querySelectorAll('.meeting-description').length === 1 && document.querySelector('.encounter-name').textContent === 'Lulu' && document.querySelector('.meeting-description').textContent.length > 30"));
        assertEquals("0",js("document.querySelectorAll('[download],.settings-qr,[data-action=preview],.meeting-permission,.meeting-options,.meeting-copy [data-gps-panel]').length"));
        js("document.querySelector('.app-tabbar [data-nav=journal]').click()");
        awaitTrue("document.body.dataset.screen === 'journal' && !!document.querySelector('[data-diary-open]')");
        js("document.querySelector('[data-diary-open]').click()");
        awaitTrue("document.body.dataset.screen === 'diary' && !!document.querySelector('#diaryText')");
        assertEquals("3",js("document.querySelectorAll('#diaryText p').length"));
        assertEquals("true",js("!/(?:you|your)\\b/i.test(document.querySelector('#diaryText').textContent)"));
        js("document.querySelector('.diary-translation summary').click();document.querySelector('[data-diary-language=zh]').click()");
        awaitTrue("document.querySelector('#diaryText').lang === 'zh'");
        js("document.querySelector('.diary-back').click()");
        awaitTrue("document.body.dataset.screen === 'journal'");
        js("window.__nativeApi=null;fetch('https://velo-soul-demo-production.up.railway.app/api/chat/status',{cache:'no-store'}).then(r=>window.__nativeApi=r.ok).catch(e=>window.__nativeApi=String(e))");
        awaitTrue("window.__nativeApi === true");
        js("location.search='?bike=mori&qr=l2-942fb6e8'");
        awaitTrue("document.body.dataset.screen === 'welcome'");
        js("document.querySelector('[data-action=encounter]').click()");
        awaitTrue("document.querySelector('[data-action=ride-voice-toggle]')?.getBoundingClientRect().height > 0 && document.querySelector('[data-action=finish]')?.getBoundingClientRect().height > 0");
        js("document.querySelector('[data-action=finish]').click()");
        awaitTrue("document.querySelector('#finishRideDialog')?.open");
        js("document.querySelector('[data-action=ride-finish-cancel]').click();document.querySelector('button[data-scene-mode=map]').click()");
        awaitTrue("!!document.querySelector('.camera-fullscreen[data-scene-mode=map]') && document.querySelector('button[data-scene-mode=map]')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('#finishRideDialog')?.open");
        js("document.querySelector('[data-action=finish]').click();document.querySelector('[data-action=ride-finish-confirm]').click()");
        awaitTrue("document.body.dataset.screen === 'finish' && !!document.querySelector('#rideNote')");
    }
}
