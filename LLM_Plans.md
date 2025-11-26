# Agent-Assisted Glyph Design and Map Generation for ScreenGrid

## 1. Introduction and Rationale

**Problem:** The core challenge for adopting ScreenGrid among non-coders (e.g., urban planners, GIS analysts, researchers) is the technical barrier to entry. This includes data preparation (aggregation, normalization) and, most significantly, designing and implementing custom glyphs, which requires writing JavaScript for the HTML5 Canvas.

**Vision:** To create an agentic LLM system that acts as a "cartographic assistant." A user can provide their dataset, describe its schema, and state their visualization goals in natural language. The agent then translates these high-level requirements into a fully functional and interactive ScreenGrid map.

**Target Audience:** Domain experts such as urban planners, social scientists, and GIS analysts who possess deep knowledge of their data but may have limited programming skills.

**Core Value:** Democratize access to advanced multivariate mapping by abstracting away the underlying code, allowing users to focus on data exploration and storytelling.

## 2. Objectives

-   **Automate Data Preprocessing:** Guide users through—or automatically handle—data loading, schema identification, and the selection of appropriate aggregation and normalization strategies.
-   **Natural Language to Glyph Design:** Enable users to describe a glyph's appearance and its mapping to data attributes (e.g., "I want a square where the color represents deprivation, and a small circle on top whose size shows the number of solar panels").
-   **Generate Glyph Plugin Code:** The agent's primary output will be a reusable **Custom Glyph Plugin** (using `GlyphRegistry`), which includes the drawing logic (`draw`) and, crucially, the legend definition (`getLegend`). This allows the system to automatically generate a legend for the user.
-   **Enable Iterative Refinement:** Support a conversational workflow where the user can progressively refine the visualization (e.g., "Make the circle blue instead," or "Let's use bars instead of circles for that variable").
-   **Deliver a Complete, Runnable Artifact:** Generate a self-contained HTML file that the user can immediately open in their browser to view and interact with their data visualization.

## 3. Proposed Architecture

A multi-agent or pipeline-based architecture would be effective for this system, separating concerns into distinct logical components.

#### Agent 1: Data Understanding & Preparation Agent

-   **Input:** User's data file (e.g., GeoJSON) and a natural language description of the schema.
-   **Tasks:**
    -   Inspect the data schema by reading properties from the input file.
    -   Engage in a dialogue to clarify data types (e.g., categorical, numerical, temporal).
    -   Recommend appropriate `aggregationFunction` (`mean`, `sum`, `count`) and `normalizationFunction` (`max-local`, `z-score`) based on data distribution and user goals.
-   **Output:** A structured JSON object describing the data schema, chosen aggregation method, and normalization settings.

#### Agent 2: Glyph Design & Code Generation Agent

-   **Input:** The structured output from the Data Agent and the user's natural language description of the desired glyph.
-   **Tasks:**
    -   **Infer Analytical Task:** Listen for keywords related to analytical goals (e.g., "compare," "trends," "distribution," "relationship"). Based on these, the agent can classify the user's primary task.
    -   **Deconstruct the Request:** Break down the user's description into visual variables (shape, size, color, position) and map them to corresponding data attributes.
    -   **Leverage a Knowledge Base:** Use the `CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md` document as a RAG (Retrieval-Augmented Generation) source to ensure cartographically sound suggestions. For instance, if a user wants to encode many variables, the agent could suggest advanced glyphs (like radial plots) or caution against visual clutter.
    -   **Propose Task-Appropriate Designs:** Based on the inferred task, recommend specific visualization strategies and interactions:
        -   **For Comparison:** Suggest interactive features like on-hover tooltips that show detailed values, or a "comparison mode" where clicking one cell highlights similar cells.
        -   **For Trend Analysis:** If temporal data is present, recommend time-series glyphs (lines, Pencil, or Helix glyphs) and suggest linking the map to a time slider control.
        -   **For Seeing Distribution:** Recommend using cell background for density and glyphs for composition, a classic and effective pattern.
    -   **Code Generation:** Translate the deconstructed design into a **Custom Glyph Plugin**. Instead of a raw function, generate a `GlyphRegistry.register('customName', { ... })` block. This structure allows the agent to define not just the `draw` method, but also the `getLegend` method, enabling the library to automatically generate a legend for the user.
    -   **Generate Layer Configuration:** Create the `ScreenGrid.ScreenGridLayerGL` configuration object, referencing the registered plugin by name (e.g., `glyph: 'customName'`).
    -   **Apply Cartographic Best Practices:** This is a critical task. The agent will act as a design advisor by:
        -   **Validating Design Choices:** Checking if the user's request aligns with ScreenGrid's strengths. If a user asks for polygon hatching or a continuous heatmap, the agent should explain why this isn't suitable and suggest alternatives (e.g., "ScreenGrid is designed to place symbols on a grid, not fill polygon shapes. For what you're describing, a better approach would be to use a standard polygon fill from the base map and add ScreenGrid glyphs on top as summaries. Would you like to try that?").
        -   **Recommending Proven Patterns:** Proactively suggest effective design patterns from the documentation, such as using cell background for a primary variable and a glyph for secondary breakdowns, or suggesting time-series glyphs for temporal data.
        -   **Guiding Variable Mapping:** Advise on how to map data to visual variables. For instance, it should know that pies/donuts are for compositional data, while bars are better for comparing magnitudes.
-   **Output:** The JavaScript code for the layer configuration, including the `onDrawCell` and interaction hooks (`onHover`, `onClick`).

#### Agent 3: Orchestrator & UI Agent

-   **Input:** Manages the workflow between the user and the other agents.
-   **Tasks:**
    -   Present the generated code and visualization to the user.
    -   Handle feedback for iterative refinement (e.g., "change the color") and pass it back to the Glyph Agent.
    -   Wrap the generated JavaScript into a complete, runnable `index.html` file, using the structure from `LAYMAN_GUIDE.md` as a template.
-   **Output:** A downloadable HTML file or a live-preview URL of the interactive map.

## 4. Implementation Ideas & Key Challenges

### 4.1. Technology Stack: Pure Client-Side & Privacy-First
The system will be implemented as a **Client-Side JavaScript Application** (e.g., using Vite). This approach is superior to a Python backend because it ensures data privacy, reduces latency, and aligns with the library's ecosystem.

-   **No Backend Required:** The application can be hosted statically (e.g., GitHub Pages).
-   **Data Processing:** Instead of Python/Pandas, we will use high-performance JavaScript libraries:
    -   **[Arquero](https://uwdata.github.io/arquero/):** For data frame operations, aggregation, and filtering directly in the browser.
    -   **[Turf.js](https://turfjs.org/):** For geometric operations (bounding boxes, centroids) if needed.
    -   **[d3-array](https://github.com/d3/d3-array):** For statistical profiling (binning, quantiles, deviations) to inform normalization strategies.
-   **LLM Interaction:** The client communicates directly with the LLM provider (OpenRouter/OpenAI) using a user-provided API key, ensuring the developer does not need to maintain a proxy server.

### 4.2. Privacy Strategy: Schema-Only Prompting
A critical advantage of the client-side approach is **Zero Data Leakage**. The user's raw data (which may be sensitive) never leaves their browser.

1.  **Local Profiling:** The app loads the GeoJSON locally. It scans the first N rows to extract metadata (column names, data types, min/max values, unique categories).
2.  **Sanitized Context:** The prompt sent to the LLM contains *only* this metadata schema and the user's natural language request.
    -   *Bad Prompt:* (Sending raw rows) "Here is the data: `{'id': 1, 'income': 50000}...` Visualize it."
    -   *Good Prompt:* "The dataset has a numerical column `income` (range: 20k-150k) and a categorical column `zone` (Commercial, Residential). The user wants to visualize income distribution."
3.  **Code Injection:** The LLM returns the plugin code, which the browser executes locally against the *full* raw dataset that is already in memory.

### 4.3. Key Challenges & Solutions
-   **Prompt Engineering & RAG:**
    -   The core of the Glyph Agent is a sophisticated prompt that instructs the LLM to generate Canvas API code based on a structured representation of the glyph design.
    -   The `CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md`, `LAYMAN_GUIDE.md`, and **`PLUGIN_GLYPH_ECOSYSTEM.md`** documents should be chunked and embedded. The RAG system must prioritize the Plugin Ecosystem guide to ensure the agent generates modular, reusable plugins with proper legend support, rather than ad-hoc functions. The RAG system must also be trained to retrieve the "What ScreenGrid is Good At" and "Things ScreenGrid is *Not* Designed For" sections.
    -   The agent's conversational flow should be modeled after the "Workflow" section of the cartography guide, asking clarifying questions about analytical goals before proposing a specific visual design.
    -   The prompt should include code snippets from `LAYMAN_GUIDE.md` as few-shot examples.
-   **Structured Input Parsing:** Use function calling or structured output capabilities of modern LLMs to parse the user's natural language request into a structured format that defines the glyph. For example:
    ```json
    {
      "glyph_elements": [
        {
          "shape": "square",
          "visual_variable": "color",
          "data_attribute": "deprivation_level",
          "mapping": "linear_gradient_green_to_red"
        },
        {
          "shape": "icon",
          "icon_type": "sun",
          "visual_variable": "visibility",
          "data_attribute": "solar_panel_percentage",
          "mapping": { "threshold": 0.5 }
        }
      ]
    }
    ```
    This structured representation can then be more reliably converted to code.
-   **Task-Oriented Prompting:** The agent's core prompt must be designed to reason about the user's analytical goals, not just their literal statements. It should be trained to follow a chain of thought:
    1.  What is the user's *goal* (e.g., compare regions)?
    2.  What is the *task* this implies (e.g., details-on-demand, brushing and linking)?
    3.  What design patterns from the knowledge base best support this task (e.g., `onHover` callbacks, coordinated views)?
    4.  How do I implement this in ScreenGrid?
-   **Cartographic Guardrails:** The agent must enforce the design philosophy of ScreenGrid. It should be explicitly programmed with knowledge of Bertin's visual variables and how they apply to a screen-space glyph engine:
    -   **Well-Supported:** `color`, `size`, `shape` (through custom glyph drawing), and `orientation` can be powerfully combined in glyphs.
    -   **Not Supported in the Traditional Sense:** `texture` (as in polygon hatching) is not a feature. The agent should re-frame such requests into using symbolic glyphs that *represent* a texture.
    -   It should understand that ScreenGrid is fundamentally about discrete symbols in cells, not continuous surfaces. This core concept must inform all of its design suggestions.
-   **User Interface:**
    -   **MVP:** A basic static web app (HTML/JS or React/Vite) where users drop a file and chat with the agent.
    -   **Full Vision:** A web application with a chat interface, a data schema viewer (or a table view of the data which can be hidden), and a live map preview that updates in real-time as the user refines their design.

## 5. Example Workflows

### 5.1. Basic Composite Glyph Design

1.  **User:** "Hi, I have data about buildings. I want to make a map showing energy efficiency and deprivation levels."
2.  **Agent 1 (Data):** "Great! Please upload your GeoJSON file. I see properties like `deprivation_index`, `epc_rating`, and `has_solar_panels`. For each grid cell, I suggest we calculate the *average* for these values. Does that sound right?"
3.  **User:** "Yes, that's perfect."
4.  **Agent 2 (Glyph):** "Understood. Now, how would you like the symbol in each cell to look?"
5.  **User:** "I'd like a main square where the background color shows the average deprivation, from green for low to red for high. If more than 50% of buildings have solar panels, add a small yellow sun icon on top."
6.  **Agent 2:** (Uses RAG to find examples of color mapping and composite glyphs, then generates a Custom Plugin with a `draw` function and a `getLegend` function, registering it via `GlyphRegistry`).
7.  **Agent 3 (Orchestrator):** "Here is a preview of your map and the generated HTML file. Would you like any changes?"
8.  **User:** "The red is too strong. Can you make it a bit lighter?"
9.  **Agent 2:** (Receives the feedback, adjusts the color calculation in the code, and regenerates the artifact).
10. **Agent 3:** "Here is the updated version."

### 5.2. Task Inference for Trend Analysis

1.  **User:** "I have crime data with timestamps for the last year. I want to see if the patterns of burglaries change over the day in different neighborhoods."
2.  **Agent 1 (Data):** "Okay, I've loaded your data. I see a `timestamp` and a `crime_type` property. I will group the records by location and hour of the day."
3.  **Agent 2 (Glyph):** "It sounds like your main goal is to analyze **temporal trends**. For this, a time-series glyph is very effective. I can create a small 24-hour line chart in each grid cell showing the hourly trend of burglaries. Would you like that?"
4.  **User:** "A line chart in each box? Yes, that's a great idea."
5.  **Agent 2:** "I also see you have other crime types. As an alternative, we could use a **Helix Glyph**, which is excellent for showing daily and weekly cycles. This would let you compare weekday vs. weekend patterns at a glance. Which do you prefer?"
6.  **User:** "Let's stick with the line chart for now, but that's good to know."
7.  **Agent 2:** (Generates a TimeSeries Plugin that draws a line chart based on hourly aggregates, including a `getLegend` method for the chart).
8.  **Agent 3 (Orchestrator):** "Here is the map with hourly trend glyphs. I've also added a placeholder for a global time slider control in the HTML if you wish to animate it later."

### 5.3. Cartographic Guidance and Proposing Alternatives

1.  **User:** "I have polygons for different city wards and their population density. I want to fill each ward with a dot density pattern."
2.  **Agent 2 (Glyph):** "I understand you want to show density within specific boundaries. ScreenGrid is designed a bit differently—it excels at showing summaries on a regular *grid* that sits on top of the map, rather than filling complex polygon shapes. A true dot-density fill is better handled by the base map engine itself."
3.  **User:** "Oh, I see. So I can't use it for this?"
4.  **Agent 2 (Glyph):** "You absolutely can, but we can approach it in a way that plays to ScreenGrid's strengths! I suggest this:
    -   First, we can show the ward boundaries as simple outlines from your GeoJSON.
    -   Then, we can use ScreenGrid's `feature-anchors` mode to place a single, powerful glyph at the center of each ward. This glyph could be a circle whose **size** represents the total population, and whose **color intensity** represents the density.
    This way, you get a clean, multi-variable summary for each ward without the visual clutter of a dot fill. How does that sound?"
5.  **User:** "That's even better! Let's do that."
6.  **Agent 2:** (Generates the configuration for `renderMode: 'feature-anchors'` and a Custom Plugin that draws the anchored glyph).

### 5.4. Adding Interactivity for Comparison

1.  **User:** "I have a map showing different socio-economic profiles with bar chart glyphs. I want to be able to easily compare one area to another."
2.  **Agent 2 (Glyph):** "To help with **comparison**, I can add an interactive feature. When you hover over a cell, I can display its detailed values in a tooltip. Would that be helpful?"
3.  **User:** "Yes, but what if I want to compare a cell with another one far away?"
4.  **Agent 2 (Glyph):** "Excellent point. In that case, I can implement a 'click-to-pin' feature. When you click a cell, its data will be 'pinned' in an info panel. Then, as you hover over other cells, the panel will show both the pinned cell's data and the hovered cell's data side-by-side, along with a visual indicator of the differences. Would you like me to add that?"
5.  **User:** "Perfect! Please do."
6.  **Agent 2:** (Generates the Plugin code with `draw` and `getLegend`, and also the necessary `onHover` and `onClick` handlers, plus the HTML/CSS for the comparison panel).
7.  **Agent 3 (Orchestrator):** "Here is the map. You can now click a cell to select it, and hover over others to see a direct comparison."


## 6. Example of Agentic Architecture Design

The following is the example of a generic architecture to implement using OpenRouter. Architecture requires three layers: routing, capability isolation, and state control.

1. Routing.
   Each agent is a discrete OpenRouter model invocation with its own system-level constraints and its own prompt constructor. You treat OpenRouter as the uniform transport layer. The router is your code, not OpenRouter’s service. You define a dispatcher that maps a task-type to an agent-config: model name, sampling parameters, and fixed instructions.

2. Capability isolation.
   Each agent receives only the context required for its function. No shared global prompt. No implicit memory. Pass outputs explicitly across agents. Use JSON-only exchanges to prevent semantic drift.

3. State control.
   Maintain a single authoritative state object in your application layer. Agents read from and write to this state through validated schemas. All cross-agent communication passes through this state, not directly between agents. Validation prevents hallucinated keys or schema divergence.

4. Models.
   Select orthogonal models through OpenRouter: reasoning-heavy model for planning; smaller latency-focused model for extraction; deterministic model for classification; generative model for synthesis. Each agent is merely a wrapper around a specific model-endpoint pairing on OpenRouter.

5. Execution.
   Define the orchestration graph. DAG is preferred:
   planner → decomposer → worker₁, worker₂, … → synthesizer → validator.
   Implement a strict handoff contract for every edge. No free-text except when explicitly needed for generative output; otherwise demand structured output.

6. Error handling.
   Wrap each agent call with a guard: retry with reduced temperature, fallback to alternative model, or escalate to the planner for re-specification. Log both request payload and response.

7. Cost control.
   Use cheaper models for frequent micro-tasks. Reserve premium reasoning models for planning and failure recovery.

8. OpenRouter specifics.
   Use a single OpenRouter API key. Each agent is implemented as a function that calls:
   POST [https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)
   with a hard-coded model name per agent. BYOK keys can be attached in your OpenRouter dashboard; orchestration code remains identical.
   Set `provider` headers only when forcing BYOK usage; otherwise omit.

9. Minimal skeleton.

```python
import requests

def call_agent(model, messages, temperature=0):
    return requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENROUTER_KEY}"},
        json={"model": model, "messages": messages, "temperature": temperature}
    ).json()

class Agent:
    def __init__(self, model, system):
        self.model = model
        self.system = system

    def run(self, content):
        messages = [
            {"role": "system", "content": self.system},
            {"role": "user", "content": content},
        ]
        return call_agent(self.model, messages)

planner = Agent(
    "anthropic/claude-3.5-sonnet",
    "Plan tasks. Output JSON list of steps."
)

extractor = Agent(
    "google/gemini-2.0-pro",
    "Extract entities. Output strict JSON."
)

synthesizer = Agent(
    "openai/gpt-4.1",
    "Integrate results. Produce final text."
)

def orchestrate(query):
    plan = planner.run(query)["choices"][0]["message"]["content"]
    steps = parse_json(plan)
    state = {}
    for step in steps:
        if step["type"] == "extract":
            out = extractor.run(step["input"])
            state[step["id"]] = parse_json(out["choices"][0]["message"]["content"])
        if step["type"] == "synth":
            out = synthesizer.run(state)
            return out["choices"][0]["message"]["content"]
```

10. Scaling.
    Introduce a queue. Each agent call becomes an asynchronous job. Orchestration engine consumes job results and triggers downstream agents. Store all intermediate states to disk or database for reproducibility.

### 6.1. Mapping the Architecture to ScreenGrid Agents

We can map the conceptual agents from Section 3 onto this technical architecture:

-   **Planner & Decomposer:** The `planner` agent takes the user's high-level request (e.g., "show me crime trends") and breaks it down into a sequence of tasks for the other agents. This corresponds to the "task inference" capability of `Agent 2`. It would create a plan like: `[analyze_data, recommend_design, generate_code, synthesize_html]`. A powerful reasoning model like `anthropic/claude-3.5-sonnet` is ideal here.

-   **Worker Agents:**
    -   **Data Agent (`Agent 1`):** A specialized worker for data analysis. It receives the user's data and returns a structured JSON schema. A fast and efficient model like `google/gemini-1.5-flash` is well-suited for this structured extraction task.
    -   **Glyph Agent (`Agent 2`):** The core creative worker. It takes the schema, the user's design prompt, and the planner's recommendations to generate the JavaScript for the **Glyph Plugin**. This requires understanding the `GlyphRegistry` API and implementing both `draw` and `getLegend` methods. This is the most complex task, requiring a top-tier model with strong reasoning and code generation skills, such as `anthropic/claude-3.5-sonnet` or `openai/gpt-4o`.
    -   **Validator Agent:** A crucial step mentioned in the DAG. This worker takes the generated code and runs it through a linter (like ESLint) to check for syntax errors. For more advanced validation, it could use a headless browser (e.g., Playwright) to perform a smoke test on the generated HTML, ensuring no runtime errors occur on load. A deterministic, cheap model can interpret the linter output.

-   **Synthesizer Agent (`Agent 3`):** This worker takes all the intermediate artifacts (schema, glyph code, validation status) from the state object and assembles the final, runnable HTML file using a template. This is a low-complexity task suitable for a fast model like `google/gemini-1.5-flash`.

### 6.2. Refined Execution Flow (DAG)

The orchestration graph for a typical user request would look like this:

`User Query` → **Planner**
`Plan` → **Data Agent** (extracts schema)
`Schema` + `User Query` → **Glyph Agent** (generates JS code)
`JS Code` → **Validator Agent** (checks for errors)
`Schema` + `JS Code` + `Validation Result` → **Synthesizer Agent**
`HTML File` → `User`

### 6.3. Cost Optimization and Open Model Strategy

To make the system economically viable and reduce dependency on proprietary models, we can implement the following strategies:

#### 1. Token Reduction Techniques

-   **Minimal State Passing:** Adhere strictly to the "capability isolation" principle. When the Planner hands off a task to the Glyph Agent, it should only pass the essential parts of the state (e.g., the user's specific design prompt and the extracted data schema), not the entire conversation history.
-   **Conversational Summarization:** For iterative refinement ("change the color"), instead of sending the full chat log, use a fast, cheap model (e.g., `mistralai/mistral-7b-instruct`) as a "summarizer agent." Its job is to distill the history into a concise instruction for the Glyph Agent (e.g., `{"action": "update_color", "target": "square_background", "new_color": "lighter_red"}`).
-   **Aggressive Caching:** Cache the outputs of the Glyph Agent. If a user request is semantically similar to a previous one (e.g., "show deprivation as color on a square"), the cached JavaScript can be retrieved and reused, avoiding an expensive model call entirely.

#### 2. Tiered (Cascading) Model Architecture

The most effective strategy is to create a "cascade" where the system defaults to free, open models and only escalates to more expensive, proprietary models when necessary. OpenRouter makes this trivial to implement.

-   **Default to Open Models:** For each agent, select a strong open-source model as the default.
-   **Validate and Escalate:** The key is the `Validator Agent`. If the code generated by the open model fails linting or a smoke test, the orchestrator should automatically re-submit the *same request* to a higher-tier proprietary model (like `anthropic/claude-3.5-sonnet`). This creates a self-correcting system that maximizes savings without sacrificing quality.

#### 3. Recommended Open Models per Agent

Here is a potential mapping of agents to capable open models available on OpenRouter:

-   **Planner & Decomposer:** Requires strong reasoning.
    -   **Default:** `qwen/qwen2-72b-instruct` or `meta-llama/llama-3.1-70b-instruct`. These are excellent at following complex instructions and breaking down tasks.
    -   **Fallback:** `anthropic/claude-3.5-sonnet`.

-   **Data Agent (Extractor):** A structured data task.
    -   **Default:** `mistralai/mistral-7b-instruct` or `google/gemma-2-9b-it`. These are fast, cheap, and very capable of outputting structured JSON when prompted correctly.

-   **Glyph Agent (Code Generator):** The most critical agent for this strategy.
    -   **Default:** A specialized open-source coding model like `deepseek/deepseek-coder-v2`. These models are specifically trained for code generation and are highly effective.
    -   **Fallback:** `anthropic/claude-3.5-sonnet` or `openai/gpt-4o`. The system should only use these if the code from `deepseek-coder-v2` is invalid.

-   **Validator & Synthesizer Agents:** These are low-complexity tasks.
    -   **Default:** A small, fast model like `meta-llama/llama-3.1-8b-instruct` is more than sufficient for interpreting linter output or assembling the final HTML from a template. There is rarely a need for a fallback here.

By combining token-saving techniques with a tiered, open-model-first architecture, the system can operate at a fraction of the cost while still maintaining a high success rate.

