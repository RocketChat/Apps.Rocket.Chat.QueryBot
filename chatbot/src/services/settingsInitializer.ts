import { IAppAccessors } from "@rocket.chat/apps-engine/definition/accessors";

export async function initializeSettings(
    accessors: IAppAccessors
): Promise<{ vectorDbEndpoint: string; model: string }> {
    const vectorDbEndpoint =
        ((await accessors.environmentReader
            .getSettings()
            .getValueById("vector_db_endpoint")) as string) || "";
    const model =
        ((await accessors.environmentReader
            .getSettings()
            .getValueById("model")) as string) || "";

    return { vectorDbEndpoint, model };
}
