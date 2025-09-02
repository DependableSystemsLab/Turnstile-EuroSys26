import sys
import os
import datetime
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.ticker import PercentFormatter, MultipleLocator

if (len(sys.argv) < 2):
    print("Provide data file")
    print("e.g., python plot-line-dataflows.py data.csv")
    sys.exit()

datafile = sys.argv[1]

vuln_df = pd.read_csv(datafile)

# Extract the series for plotting
tool_a_data = vuln_df['Turnstile']
tool_b_data = vuln_df['CodeQL']
manual_data = vuln_df['Manual']

def plot_sorted_distribution(ax, data, label, color, linestyle='-'):
    sorted_data = np.sort(data.dropna())
    
    num_apps = len(sorted_data)
    x_axis_percentage = np.arange(1, num_apps + 1) / num_apps * 100
    
    # Plot the data
    ax.plot(x_axis_percentage, sorted_data, label=label, color=color, linestyle=linestyle, linewidth=2.5)

plt.style.use('seaborn-v0_8-whitegrid')
fig, ax = plt.subplots(figsize=(8, 4))

# Plot each series
plot_sorted_distribution(ax, tool_a_data, "Turnstile", "blue", linestyle='--')
plot_sorted_distribution(ax, tool_b_data, "CodeQL", "red", linestyle='--')
plot_sorted_distribution(ax, manual_data, "Manual", "green", linestyle='-')

# --- Formatting ---
ax.set_xlabel("Percentage of Applications", fontsize=15, labelpad=15)
ax.set_ylabel("Number of Privacy-sensitive\nDataflows Found", fontsize=15, labelpad=15)

ax.xaxis.set_major_formatter(PercentFormatter())

# Customize ticks
ax.tick_params(axis='both', which='major', labelsize=12, pad=8)
ax.set_xlim(0, 100)
ax.set_ylim(0, 20)
ax.xaxis.set_major_locator(MultipleLocator(10))
ax.yaxis.set_major_locator(MultipleLocator(2))

# Add a legend
ax.legend(loc='upper center', bbox_to_anchor=(0.5, 1.2), ncol=3, frameon=False, fontsize=15, handlelength=4)

ax.grid(True, which='both', linestyle='--', linewidth=0.5)

plt.tight_layout(rect=[0, 0.02, 1, 0.98])

now = datetime.datetime.now()
timestamp = now.strftime("%Y%m%d_%H%M%S")
output_path = os.environ.get('TURNSTILE_OUTPUT_ROOT') + '/line-plot.' + timestamp + '.png'
plt.savefig(output_path, dpi=300)
print("Plot saved to " + output_path)