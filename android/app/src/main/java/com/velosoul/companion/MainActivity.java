package com.velosoul.companion;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VeloMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
