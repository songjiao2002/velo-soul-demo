package com.velosoul.companion;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(name = "VeloMedia", permissions = {
    @Permission(alias = "camera", strings = {Manifest.permission.CAMERA}),
    @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}),
    @Permission(alias = "headset", strings = {Manifest.permission.BLUETOOTH_CONNECT})
})
public class VeloMediaPlugin extends Plugin {
    @PluginMethod public void prepare(PluginCall call) {
        ArrayList<String> pending = new ArrayList<>();
        if (call.getBoolean("camera", false) && getPermissionState("camera") != PermissionState.GRANTED) pending.add("camera");
        if (call.getBoolean("microphone", false)) {
            if (getPermissionState("microphone") != PermissionState.GRANTED) pending.add("microphone");
            // Allows Android/WebView to use an already paired headset. No scan,
            // pairing, device selection, speaker override or Bluetooth toggle.
            var preferences = getContext().getSharedPreferences("velo-media", 0);
            if (Build.VERSION.SDK_INT >= 31 && getPermissionState("headset") != PermissionState.GRANTED && !preferences.getBoolean("headsetAsked", false)) {
                preferences.edit().putBoolean("headsetAsked", true).apply();
                pending.add("headset");
            }
        }
        if (pending.isEmpty()) permissionsReady(call);
        else requestPermissionForAliases(pending.toArray(new String[0]), call, "permissionsReady");
    }

    @PermissionCallback private void permissionsReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("camera", getPermissionState("camera") == PermissionState.GRANTED);
        result.put("microphone", getPermissionState("microphone") == PermissionState.GRANTED);
        result.put("headset", Build.VERSION.SDK_INT < 31 || getPermissionState("headset") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
                call.resolve();
            } catch (Exception error) { call.reject("Could not open app settings"); }
        });
    }
}
