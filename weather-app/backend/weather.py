import requests
import sys

def get_weather_forecast(city):
    api_key = '7ea02f0f1e3fcd6d3525d0895ae7d2ca'
    url = f'http://api.openweathermap.org/data/2.5/forecast?q={city}&cnt=2&units=metric&appid={api_key}'
    
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        forecasts = data['list']
        forecast_data = []
        
        for forecast in forecasts:
            forecast_data.append({
                'time': forecast['dt_txt'],
                'temperature': forecast['main']['temp'],
                'weather': forecast['weather'][0]['description']
            })
        
        return forecast_data
    else:
        print(f"Error fetching data: {response.status_code}")
        sys.exit(1)

if __name__ == "__main__":
    city = sys.argv[1] if len(sys.argv) > 1 else "London"
    forecast = get_weather_forecast(city)
    for item in forecast:
        print(f"Time: {item['time']} | Temp: {item['temperature']}°C | Weather: {item['weather']}")

