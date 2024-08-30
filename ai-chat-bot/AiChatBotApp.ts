import {
    IAppAccessors,
    IConfigurationExtend,
    ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { AskCommand } from "./src/command/AskCommend";
import { settings } from "./src/settings/AddSettings";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";

export class AiChatBotApp extends App {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(configuration: IConfigurationExtend) {
        await Promise.all([
            ...settings.map((setting) =>
                configuration.settings.provideSetting(setting)
            ),
            configuration.slashCommands.provideSlashCommand(
                new AskCommand(this.getAccessors(), this)
            ),
        ]);
    }
}
