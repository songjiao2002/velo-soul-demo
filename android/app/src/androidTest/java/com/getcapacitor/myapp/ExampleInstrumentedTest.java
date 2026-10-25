package com.getcapacitor.myapp;

import static org.junit.Assert.*;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.velosoul.companion.MainActivity;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
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
    @Test public void bundledAppScannerAndCompanionWork() throws Exception {
        assertEquals("com.velosoul.companion",InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        awaitTrue("document.body.dataset.screen === 'home' && document.querySelector('#startupNotice').hidden");
        assertEquals("true",js("window.isSecureContext && Capacitor.isNativePlatform() && !!navigator.mediaDevices?.getUserMedia"));
        assertEquals("4",js("document.querySelectorAll('.app-tabbar button').length"));
        js("document.querySelector('.app-tabbar [data-action=scan]').click()");
        awaitTrue("document.body.dataset.screen === 'scan' && !!window.jsQR && !!document.querySelector('#cameraStart')");
        js("window.__qrCheck=null;(async()=>{try{const answers=[];for(const id of ['lumi','bori','mori']){const image=new Image();image.src='/qr-'+id+'.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const code=jsQR(pixels.data,canvas.width,canvas.height);answers.push(code?.data==='https://velo-soul-demo-production.up.railway.app/?bike='+id);}window.__qrCheck=answers.every(Boolean);}catch(e){window.__qrCheck=String(e);}})()");
        awaitTrue("window.__qrCheck === true");
        js("document.querySelector('.app-tabbar [data-studio-open]').click()");
        awaitTrue("document.querySelector('.companion-studio')?.open");
        js("document.querySelector('[data-studio-soul=mori]').click();document.querySelector('[data-studio-use]').click()");
        awaitTrue("document.body.dataset.screen === 'welcome' && location.search === '?bike=mori'");
        js("window.__nativeApi=null;fetch('https://velo-soul-demo-production.up.railway.app/api/chat/status',{cache:'no-store'}).then(r=>window.__nativeApi=r.ok).catch(e=>window.__nativeApi=String(e))");
        awaitTrue("window.__nativeApi === true");
    }
}
