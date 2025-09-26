import fs from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";


const API_URL = "https://ig.gov-cloud.ai/bob-camunda/v1.0/camunda/execute/01995124-fd4c-73ba-aa51-972192c31b94?env=TEST&sync=true";
const AUTH_TOKEN = "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI3Ny1NUVdFRTNHZE5adGlsWU5IYmpsa2dVSkpaWUJWVmN1UmFZdHl5ejFjIn0.eyJleHAiOjE3MjYxODIzMzEsImlhdCI6MTcyNjE0NjMzMSwianRpIjoiOGVlZTU1MDctNGVlOC00NjE1LTg3OWUtNTVkMjViMjQ2MGFmIiwiaXNzIjoiaHR0cDovL2tleWNsb2FrLmtleWNsb2FrLnN2Yy5jbHVzdGVyLmxvY2FsOjgwODAvcmVhbG1zL21hc3RlciIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmNzFmMzU5My1hNjdhLTQwYmMtYTExYS05YTQ0NjY4YjQxMGQiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJIT0xBQ1JBQ1kiLCJzZXNzaW9uX3N0YXRlIjoiYmI1ZjJkMzktYTQ3ZC00MjI0LWFjZGMtZTdmNzQwNDc2OTgwIiwibmFtZSI6ImtzYW14cCBrc2FteHAiLCJnaXZlbl9uYW1lIjoia3NhbXhwIiwiZmFtaWx5X25hbWUiOiJrc2FteHAiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJwYXNzd29yZF90ZW5hbnRfa3NhbXhwQG1vYml1c2R0YWFzLmFpIiwiZW1haWwiOiJwYXNzd29yZF90ZW5hbnRfa3NhbXhwQG1vYml1c2R0YWFzLmFpIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiLyoiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtbWFzdGVyIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7IkhPTEFDUkFDWSI6eyJyb2xlcyI6WyJIT0xBQ1JBQ1lfVVNFUiJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwic2lkIjoiYmI1ZjJkMzktYTQ3ZC00MjI0LWFjZGMtZTdmNzQwNDc2OTgwIiwidGVuYW50SWQiOiJmNzFmMzU5My1hNjdhLTQwYmMtYTExYS05YTQ0NjY4YjQxMGQiLCJyZXF1ZXN0ZXJUeXBlIjoiVEVOQU5UIn0=.FXeDyHBhlG9L4_NCeSyHEaNEBVmhFpfSBqlcbhHaPaoydhKcA0BfuyHgxg_32kQk6z5S9IQ7nVKS2ybtOvwo0WyLWwLQchSq7Noa7LooHIMzmeWMQb_bLKtbaOti59zwIdS8CkfGaXut7RUQKISQVWmbUGsVJQa2JkG6Ng_QN0y5hFVksMWPZiXVsofQkJXHXV1CQ3gabhhHKo3BqlJwzpsCKLDfg1-4PmSl1Wqbw03Ef2yolroj5i8FoeHukOQPkwCUHrrNw-ilIp917nqZa89YbCMtDjWyaj8pEH7GJR5vMZPE2WcJPn5dSA1IHVunfatEB1cDAitaFjVNWNnddQ";


const folders = ["line"];
// ["bar", "pie", "area", "qq-plot", "barline", "scatter", "donut", "halfPie", "nested-pies", "bubble", "sankey", "geo-bubble-latlon", "geo-bubble-countryname", "geo-bubble-countryId", "choropleth-countryname", "choropleth-countryname", "geo-spike-countryname", "geo-spike-countryId", "geo-spike-latlon", "geo-graph-latlon", "geo-graph-countryname", "geo-graph-countryId", "calendar-heatmap", "matrix-heatmap", "dendrogram", "kmeans", "exp-regression", "candlestick", "force", "grouped-bar", "stacked-area", "stacked-line", "histogram", "treemap", "word-cloud", "box-plot", "radial-area", "hexbin", "geo-hexbin-latlon", "geo-hexbin-countryname", "geo-hexbin-countryId", "chord", "arc-diagram"];
console.log("Num of folders: ", folders.length);

async function uploadChart(payload) {
    try {
        const formData = new FormData();

        formData.append("chartName", payload.chartName);
        formData.append("chartData", JSON.stringify(payload.chartData));
        formData.append("chartConfig", JSON.stringify(payload.chartConfig));

        const response = await axios.post(API_URL, formData, {
            headers: {
                ...formData.getHeaders(),
                Authorization: AUTH_TOKEN
            }
        });

        console.log(`✅ Uploaded ${payload.chartName}:`, response.status);
        return response;
    } catch (err) {
        console.error(`❌ Error uploading ${payload.chartName}:`, err.message);
        throw err;
    }
}

async function processFolders() {
    for (const folder of folders) {
        try {
            const folderPath = `./NewChartConfigsEcore/${folder}`;
            const files = await fs.readdir(folderPath);

            // collect files
            const dataFiles = files.filter(f => f.endsWith("Data.json"));
            const configFiles = files.filter(f => f.endsWith("Config.json"));

            if (dataFiles.length !== 1 || configFiles.length !== 1) {
                console.warn(`\nSkipping ${folder} - invalid number of required files\n`);
                continue;
            }

            const dataFile = dataFiles[0];
            const configFile = configFiles[0];

            // parse JSON files
            const dataContent = JSON.parse(await fs.readFile(path.join(folderPath, dataFile), "utf8"));
            const configContent = JSON.parse(await fs.readFile(path.join(folderPath, configFile), "utf8"));

            const chartName = path.basename(folder);

            const payload = {
                chartName,
                chartData: dataContent,
                chartConfig: configContent
            };

            // Sequential API call (waits for each one)
            // console.log(JSON.stringify(payload, null, 2));
            await uploadChart(payload);

        } catch (err) {
            console.error(`❌ Error processing folder ${folder}:`, err.message);
        }
    }
}

processFolders();