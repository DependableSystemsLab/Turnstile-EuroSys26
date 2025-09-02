import sys
import csv
import os
import datetime
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
import numpy as np

if (len(sys.argv) < 2):
	print("Provide data file")
	print("e.g., python plot-bar-applications.py data.csv")
	sys.exit()

datafile = sys.argv[1]

apps = []

with open(datafile) as csvfile:
	reader = csv.DictReader(csvfile)
	for row in reader:
		apps.append(row)

# Example data
appNames = [item['Application'] for item in apps]
# print(appNames)
exps = list(apps[0].keys())[1:]
# print(exps)
measurements = [
	[ float(item[expName]) for expName in exps ] for item in apps
]
# print(measurements)

# Parameters for the plot
x = np.arange(len(appNames))  # x locations for the groups
width = 0.15  # Width of each bar

# Create the plot
# fig, (ax1, ax2) = plt.subplots(2, 1, sharex=True, figsize=(12, 4.5), height_ratios=[1, 1])
fig, ax1 = plt.subplots(figsize=(16, 4))

# Plot each experiment's bars
# for i, exp in enumerate(exps):
#     # print([measurement[i] for measurement in measurements])
#     heights = [measurement[i] for measurement in measurements]
#     ax1.bar(x + i * width, heights, width, label=exp)
#     ax2.bar(x + i * width, heights, width)

# Baseline
heights = [measurement[0] for measurement in measurements]
ax1.bar(x + 0 * width, heights, width, label=exps[0], zorder=3)
# ax2.bar(x + 0 * width, heights, width, zorder=3)

heights = [measurement[1] for measurement in measurements]
ax1.bar(x + 0.05 + 1 * width, heights, width, label=exps[1])
# ax2.bar(x + 0.05 + 1 * width, heights, width)

heights = [measurement[2] for measurement in measurements]
ax1.bar(x + 0.05 + 2 * width, heights, width, label=exps[2])
# ax2.bar(x + 0.05 + 2 * width, heights, width)

# heights = [measurement[3] for measurement in measurements]
# ax1.bar(x + 0.05 + 1 * width, heights, width, label=exps[3], zorder=3)
# ax2.bar(x + 0.05 + 1 * width, heights, width, zorder=3)

heights = [measurement[3] for measurement in measurements]
ax1.bar(x + 0.1 + 3 * width, heights, width, label=exps[3])
# ax2.bar(x + 0.1 + 3 * width, heights, width)

heights = [measurement[4] for measurement in measurements]
ax1.bar(x + 0.1 + 4 * width, heights, width, label=exps[4])
# ax2.bar(x + 0.1 + 4 * width, heights, width)

# heights = [measurement[6] for measurement in measurements]
# ax1.bar(x + 0.1 + 2 * width, heights, width, label=exps[6], zorder=3)
# ax2.bar(x + 0.1 + 2 * width, heights, width, zorder=3)

# Set y-axis limits for both axes
# ax1.set_ylim(9, 12)  # Upper range (for outliers)
# ax2.set_ylim(0, 3)   # Lower range (for normal values)
ax1.set_ylim(0, 3)  # Upper range (for outliers)

# Ensure both y-axes use rounded ticks
# ax1.yaxis.set_major_locator(MaxNLocator(integer=True))  # Rounded ticks for upper axis
# ax2.yaxis.set_major_locator(MaxNLocator(integer=True))  # Rounded ticks for lower axis

# Hide spines between the two axes
# ax1.spines['bottom'].set_visible(False)
# ax2.spines['top'].set_visible(False)
# ax1.xaxis.tick_top()
# ax1.tick_params(labeltop=False)  # Don't draw x-axis labels on the upper plot
# ax2.xaxis.tick_bottom()

# Add diagonal lines to indicate the break
# d = 0.01  # Size of diagonal lines
# kwargs = dict(transform=ax1.transAxes, color='k', clip_on=False)
# ax1.plot((-d, +d), (-d, +d), **kwargs)  # Top-left diagonal
# ax1.plot((1 - d, 1 + d), (-d, +d), **kwargs)  # Top-right diagonal

# kwargs.update(transform=ax2.transAxes)  # Switch to lower axes
# ax2.plot((-d, +d), (1 - d, 1 + d), **kwargs)  # Bottom-left diagonal
# ax2.plot((1 - d, 1 + d), (1 - d, 1 + d), **kwargs)  # Bottom-right diagonal

# # Add labels and title
# ax2.set_xticks(x + width * 2.5)
# ax2.set_xticklabels(appNames, rotation=90)
# ax2.set_xlabel('Applications')
# ax2.set_ylabel('Relative Run-time')
# ax1.legend()

# ax1.set_title('Relative Run-time in Different Runs for Each Application')
ax1.set_xticks(x + width * 2.5)
ax1.set_xticklabels(appNames, rotation=90)
ax1.set_xlabel('Applications')
ax1.set_ylabel('Relative Run-time')
ax1.legend(loc='upper left')

# Show grid lines in light gray
ax1.grid(True, color='lightgray', linestyle='--', linewidth=0.5, zorder=0)
# ax2.grid(True, color='lightgray', linestyle='--', linewidth=0.5, zorder=0)

# Save the plot
plt.subplots_adjust(bottom=0.25)
plt.tight_layout()
plt.show()

now = datetime.datetime.now()
timestamp = now.strftime("%Y%m%d_%H%M%S")
output_path = os.environ.get('TURNSTILE_OUTPUT_ROOT') + '/bar-plot.' + timestamp + '.png'
plt.savefig(output_path, dpi=300) 
print("Plot saved to " + output_path)