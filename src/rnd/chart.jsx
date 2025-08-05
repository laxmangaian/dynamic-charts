// pseudo-JS
import vegaEmbed from 'vega-embed';
import * as vega from 'vega';

async function render(chartSpec, data, elementId){
  const spec = JSON.parse(JSON.stringify(chartSpec));          
  if(data){                                                    
    spec.datasets = spec.datasets || {};
    spec.datasets.dataset = data;
  }
  const {view} = await vegaEmbed(elementId, spec, {actions:false}); 
  return view;                                               
}

// later dynamic update
view.change('dataset',vega.changeset().remove(()=>true).insert(newData)).run();



const chartSpec = {
  "datasets":{
    "dataset":[] ,
    "links":[]
  },
  "signals":[
    {"name":"cx","update":"width / 2"},
    {"name":"cy","update":"height / 2"}
  ],
  "marks":[
    {
      "name":"linkpath",
      "type":"path",
      "from":{"data":"links"},
      "encode":{
        "update":{
          "stroke":{"value":"#aaa"},
          "strokeWidth":{"value":1.2}
        }
      },
      "transform":[{"type":"linkpath","sourceX":"source.x","sourceY":"source.y",
                    "targetX":"target.x","targetY":"target.y"}]
    },
    {
      "name":"node",
      "type":"symbol",
      "from":{"data":"dataset"},
      "encode":{
        "enter":{
          "fill":{"value":"steelblue"},
          "size":{"value":200}
        },
        "update":{
          "x":{"field":"x"},
          "y":{"field":"y"}
        }
      },
      "transform":[{"type":"force","iterations":200,
                    "links":"links",
                    "linkDistance":30,
                    "static":false}]
    }
  ]
}


render(chartSpec,)