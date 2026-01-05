use wasm_bindgen::prelude::*;

// Import JavaScript functions from scene.js
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_name = initScene)]
    fn init_scene();
}

#[wasm_bindgen]
pub struct App {
    initialized: bool,
}

#[wasm_bindgen]
impl App {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<App, JsValue> {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        console_log::init_with_level(log::Level::Debug)
            .expect("Failed to initialize logger");

        log::info!("shipwith.dev initializing...");

        Ok(App { initialized: false })
    }

    #[wasm_bindgen]
    pub fn start(&mut self) -> Result<(), JsValue> {
        log::info!("Starting application...");

        // Initialize Three.js scene
        init_scene();
        log::info!("Three.js scene initialized");

        self.initialized = true;
        log::info!("Application started successfully");

        Ok(())
    }
}

impl Default for App {
    fn default() -> Self {
        App::new().unwrap()
    }
}
