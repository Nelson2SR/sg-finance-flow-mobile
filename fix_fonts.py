import os
import glob

files = glob.glob('app/**/*.tsx', recursive=True) + glob.glob('components/**/*.tsx', recursive=True)

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace <Text className=" with <Text className="font-jakarta 
    new_content = content.replace('<Text className="', '<Text className="font-jakarta ')
    # Catch cases where there's no space
    new_content = new_content.replace("<Text className='", "<Text className='font-jakarta ")
    # Bold mapping intercept
    new_content = new_content.replace('font-jakarta font-bold', 'font-jakarta-bold')
    new_content = new_content.replace('font-bold', 'font-jakarta-bold')

    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print("Updated font structure in", file_path)

