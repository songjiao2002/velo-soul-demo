# GPS location connection

The homepage and each soul's encounter page expose a Connect GPS location button. It requests only browser geolocation, without opening the camera or microphone. Starting the existing live companion still starts GPS alongside the explicitly requested media features.

Status is available in Korean, English and Chinese: off, requesting/waiting, connected, low accuracy, denied, unavailable and paused. Stopping location clears the watcher and ignores late callbacks. Permission denial and timeout provide a reconnect action. The app cannot override a denied browser or OS permission; the user must enable it in site settings.

A current position must have finite, valid coordinates and nonnegative accuracy, with a timestamp no more than 30 seconds old or 5 seconds in the future. Accuracy worse than 60 metres remains a waiting/low-accuracy state and is not used to trigger places or new weather requests. The live homepage map uses the accepted position rather than presenting the initial Seoul preview as a location fix. Stopping clears its live position marker. Page navigation or leaving the visible page stops location; the live companion can start it again using the previously granted permission.

GPS feeds the existing map, ride distance/speed, nearby registered places and weather features. Weather queries use approximately 2 km grid coordinates, and location alone does not activate voice or camera uploads. Map tiles reveal the displayed area and IP to the map provider, as documented by the map privacy notice. Existing QR URLs are unchanged.

Browser integration uses simulated permission success, denial, timeout, inaccurate positions, stop/retry and late callbacks. Physical location accuracy and browser permission behavior still require phone testing.
