<div align="center">
<img width=30% src="https://github.com/user-attachments/assets/a92f27b9-5101-4725-8311-a0e6ada0edc7" alt="rocketchat-logo">
</div>

<h1>AI Query Bot</h1> <h3>A Configurable Retrieval-Augmented Generation (RAG) Pipeline Executor for Rocket.Chat</h3>

The AI Query Bot transforms Rocket.Chat into a powerful personal assistant. Whether you're managing work schedules, handling internal knowledge, or extracting insights from large discussions, this bot can find the answers you need.

<div align="center">
  <img width=60% src="https://github.com/user-attachments/assets/144febb6-7399-4f94-b49b-99e80a5ddc9e" alt="app-icon">
</div>

<h2>Features 🚀</h2>
<ul>
  <li>Configurable RAG Pipeline: Customize the pipeline through the app's settings, controlling aspects such as the embedding/tokenizer engine, vector database, and more.</li> 
  <li>Support for Multiple LLMs: Choose from various open-source LLMs like Mistral, Llama, and Phi for response generation.</li>
  <li>Interactive and User-Friendly:
Users can interact with the bot using simple slash commands, making it easy to query information and receive summaries without needing to navigate away from the chat interface.
</li>
  <li>Customizable Responses:
Format responses in markdown, allowing for rich text outputs including bullet points, numbered lists, links, and more. This ensures that the responses are not only informative but also easy to read and understand.</li>
  <li>Secure and Efficient: Ensures secure communication while delivering accurate and contextually relevant responses.</li>
  
</ul>
<h2 >How to set up 💻</h2>

<ol>
  <li>Have a Rocket.Chat server ready. If you don't have a server, see this <a href="https://developer.rocket.chat/v1/docs/server-environment-setup">guide</a>.</li> 
  <li>Install the Rocket.Chat Apps Engline CLI. 
  
  ``` 
    npm install -g @rocket.chat/apps-cli
  ```
  
  Verify if the CLI has been installed 
  
  ```
  rc-apps -v
# @rocket.chat/apps-cli/1.4.0 darwin-x64 node-v10.15.3
  ```
  </li>
  <li>Clone the GitHub Repository</li>
    
 ```
    git clone https://github.com/RocketChat/Apps.Chat.Summarize.git
 ```
  
  <li>Install app dependencies</li>
  
  ```
    cd app && npm install
  ```
  
  <li>To install private Rocket.Chat Apps on your server, it must be in development mode. Enable Apps development mode by navigating to <i>Administration > General > Apps</i> and turn on "Enable development mode".</li>
  
  <li>Deploy the app to the server </li>
  
  ```
  rc-apps deploy --url <server_url> --username <username> --password <password>
  ```
  
  - If you are running server locally, `server_url` is http://localhost:3000. If you are running in another port, change the 3000 to the appropriate port.
  - `username` is the username of your admin user.
  - `password` is the password of your admin user.
</ol>

<h2>How to use 💬</h2>

After setting up, you can start using the AI Query Bot by typing <code>/ask </code> followed by your query in any Rocket.Chat channel,. The bot will process your query through the configured RAG pipeline and provide a concise, contextually relevant response.

<div align="center">
<img width="766" alt="Screenshot 2024-08-25 at 8 24 52 PM" src="https://github.com/user-attachments/assets/0e95e129-37fa-4807-a8c9-fe520dd1ad53">
</div>

<h2>Support us ❤️</h2>

If you like this project, please leave a star ⭐️. This helps more people to know this project.
