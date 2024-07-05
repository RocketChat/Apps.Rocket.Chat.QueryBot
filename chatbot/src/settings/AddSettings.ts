import {
    ISetting,
    SettingType,
} from "@rocket.chat/apps-engine/definition/settings";

export const settings: ISetting[] = [
    {
        id: "model",
        i18nLabel: "Model selection",
        i18nDescription: "Select the LLM model endpoint you want to use.",
        type: SettingType.SELECT,
        values: [
            { key: "llama3-70b", i18nLabel: "Llama3 70B" },
            { key: "mistral-7b", i18nLabel: "Mistral 7B" },
        ],
        required: true,
        public: true,
        packageValue: "llama3-70b",
    },
    {
        id: "vector_db_endpoint",
        i18nLabel: "Vector DB Endpoint",
        i18nDescription:
            "Input the endpoint of the vector database (e.g., Weaviate/Milvus).",
        type: SettingType.STRING,
        required: true,
        public: true,
        packageValue: "http://weaviate:8080/v1/graphql",
    },
];
