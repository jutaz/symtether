package com.example;

public class Engine {
    public static final int MAX_RPM = 9000;

    private int rpm;

    public void start() {
        this.rpm = 800;
    }

    public void rev(int target) {
        this.rpm = Math.min(target, MAX_RPM);
    }

    public interface Listener {
        void onRedline();
    }
}
