import sys
import csv
import os
import datetime
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import ScalarFormatter, LogLocator, FormatStrFormatter, FuncFormatter

if (len(sys.argv) < 2):
	print("Provide data file")
	print("e.g., python plot-area-applications.py data.csv")
	sys.exit()

datafile = sys.argv[1]

data = []

with open(datafile) as csvfile:
	reader = csv.DictReader(csvfile)
	for row in reader:
		data.append(row)

# Example discrete data
frequency = np.array([ float(item['Frequency']) for item in data ])  # Discrete frequencies in Hz
min_runtime_1 = np.array([ float(item['Selective-Min']) for item in data ])  # Minimum runtime for area 1
med_runtime_1 = np.array([ float(item['Selective-Med']) for item in data ])  # Median runtime for area 1
max_runtime_1 = np.array([ float(item['Selective-Max']) for item in data ])  # Maximum runtime for area 1
min_runtime_2 = np.array([ float(item['Exhaustive-Min']) for item in data ])  # Minimum runtime for area 2
med_runtime_2 = np.array([ float(item['Exhaustive-Med']) for item in data ])  # Median runtime for area 2
max_runtime_2 = np.array([ float(item['Exhaustive-Max']) for item in data ])  # Maximum runtime for area 2

# Create the plot
# plt.figure(figsize=(6, 4))
plt.figure(figsize=(6, 3.5))

plt.yscale('log')
plt.xscale('log')

# First shaded area
plt.plot(frequency, min_runtime_1, color='blue', zorder=4)
plt.plot(frequency, med_runtime_1, label='Selectively-managed (Median)', color='blue', linestyle='--', marker='o', markersize=2, zorder=6)
plt.plot(frequency, max_runtime_1, color='blue', zorder=4)
plt.fill_between(frequency, min_runtime_1, max_runtime_1, color='lightblue', alpha=0.7, label='Selectively-managed', zorder=4)

# Second shaded area
plt.plot(frequency, min_runtime_2, color='red', zorder=3)
plt.plot(frequency, med_runtime_2, label='Exhaustively-managed (Median)', color='red', linestyle='--', marker='o', markersize=2, zorder=5)
plt.plot(frequency, max_runtime_2, color='red', zorder=3)
plt.fill_between(frequency, min_runtime_2, max_runtime_2, color='lightsalmon', alpha=0.35, label='Exhaustively-managed', zorder=3)

# Customize ticks on the x-axis
plt.xticks(rotation=90)

x_major_locator = LogLocator(base=10.0, subs=[], numticks=10)  # Major ticks at powers of 10
x_minor_locator = LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1, numticks=10)  # Minor ticks between
plt.gca().xaxis.set_major_locator(x_major_locator)
plt.gca().xaxis.set_major_formatter(ScalarFormatter())
plt.gca().xaxis.set_minor_locator(x_minor_locator)
plt.gca().xaxis.set_minor_formatter(FormatStrFormatter("%d"))

# Rotate minor tick labels
for label in plt.gca().xaxis.get_minorticklabels():
    label.set_rotation(90)
    # label.set_horizontalalignment('right')

# Customize ticks on the y-axis
y_major_locator = LogLocator(base=10.0, subs=[], numticks=10)
y_minor_locator = LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1, numticks=10)
plt.gca().yaxis.set_major_locator(y_major_locator)
plt.gca().yaxis.set_major_formatter(FuncFormatter(lambda x, pos: f'{int(round(x))}'))
plt.gca().yaxis.set_minor_locator(y_minor_locator)
plt.gca().yaxis.set_minor_formatter(FormatStrFormatter("%d"))  # Label minor ticks

# Adjust the minor tick label size
plt.tick_params(axis='x', which='minor', labelsize=8)  # Change 8 to desired size
plt.tick_params(axis='y', which='minor', labelsize=8)

# Add vertical guide lines
plt.axvline(x=30, color='darkgray', linestyle='--', linewidth=1)
plt.axvline(x=250, color='darkgray', linestyle='--', linewidth=1)

# Annotate the guide lines
plt.text(30, 3.5, '30 Hz', color='darkgray', fontsize=10, rotation=90, ha='right')
plt.text(250, 14, '250 Hz', color='darkgray', fontsize=10, rotation=90, ha='right')

# Add labels and legend
plt.xlabel('Input Rate (Hz)')
plt.ylabel('Relative Run-time')
plt.legend()
plt.grid(which='both', linestyle='--', linewidth=0.5, color='lightgray', alpha=0.7, zorder=0)
plt.minorticks_on()  # Ensure minor ticks are visible
plt.grid(which='minor', linestyle=':', linewidth=0.5, color='lightgray', alpha=0.5, zorder=0)

# Save the plot
plt.subplots_adjust(bottom=0.25)
plt.tight_layout()

now = datetime.datetime.now()
timestamp = now.strftime("%Y%m%d_%H%M%S")
output_path = os.environ.get('TURNSTILE_OUTPUT_ROOT') + '/area-plot.' + timestamp + '.png'
plt.savefig(output_path, dpi=300) 
print("Plot saved to " + output_path)