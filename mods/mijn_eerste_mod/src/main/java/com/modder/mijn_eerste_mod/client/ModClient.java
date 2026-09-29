package com.modder.mijn_eerste_mod.client;

import net.fabricmc.api.ClientModInitializer;
import com.modder.mijn_eerste_mod.ModMain;
import net.minecraft.client.gui.screens.MenuScreens;
import com.modder.mijn_eerste_mod.gui.ModScreenHandlers;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.minecraft.client.render.entity.PigRenderer;
import com.modder.mijn_eerste_mod.ModEntities;

/**
 * Client-registratie: schermen (GUI's) en mob-renderers.
 */
public class ModClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        MenuScreens.register(ModScreenHandlers.MIJN_WERKBANK, MijnWerkbankScreen::new);
        MenuScreens.register(ModScreenHandlers.GLITCH, GlitchScreen::new);
        // TODO: eigen model/texture? Vraag de AI! (nu: varken-look als voorbeeld)
        EntityRendererRegistry.register(ModEntities.G_LI_TCH, PigRenderer::new);
        ModMain.LOGGER.debug("Client geladen.");
    }
}
