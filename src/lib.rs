use wasm_bindgen::prelude::*;
use web_sys::window;

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

        let window = window().ok_or("No window")?;
        let document = window.document().ok_or("No document")?;

        let canvas = document
            .get_element_by_id("scene")
            .ok_or("No canvas element")?;

        log::info!("Canvas found: {:?}", canvas.tag_name());

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
