import { IAppAccessors } from "@rocket.chat/apps-engine/definition/accessors";

export async function initializeSettings(
    accessors: IAppAccessors
): Promise<{ vectorDbEndpoint: string; llmEndpoint: string }> {
    const vectorDbEndpoint =
        ((await accessors.environmentReader
            .getSettings()
            .getValueById("vector_db_endpoint")) as string) || "";
    const llmEndpoint =
        ((await accessors.environmentReader
            .getSettings()
            .getValueById("llm_endpoint")) as string) || "";

    return { vectorDbEndpoint, llmEndpoint };
}
