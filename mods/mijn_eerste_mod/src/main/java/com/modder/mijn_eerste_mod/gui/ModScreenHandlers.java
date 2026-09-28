package com.modder.mijn_eerste_mod.gui;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.inventory.MenuType;

/**
 * Registreert alle GUI's (menu's) van deze mod.
 * ⚠️ Compilefout op MenuType? → Copy-paste de fout in chat, ik fix hem in ai-code/.
 */
public final class ModScreenHandlers {
    private ModScreenHandlers() {}

    public static final MenuType<MijnWerkbankMenu> MIJN_WERKBANK = register("mijn_werkbank", MijnWerkbankMenu::new);
    public static final MenuType<GlitchMenu> GLITCH = register("glitch", GlitchMenu::new);

    private static <T extends net.minecraft.world.inventory.AbstractContainerMenu> MenuType<T> register(
            String path, MenuType.MenuFactory<T> factory) {
        ResourceKey<MenuType<T>> key = ResourceKey.create(Registries.MENU, ModMain.id(path));
        return Registry.register(BuiltInRegistries.MENU, key, new MenuType<>(factory));
    }

    public static void initialize() {
        // geladen via statische velden
    }
}
